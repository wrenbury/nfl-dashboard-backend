// football_dash_frontend/src/pages/Game.tsx

import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import useSWR from "swr";
import { API } from "../api";
import BoxScore from "../components/bento/BoxScore";
import TeamStats from "../components/bento/TeamStats";
import PlayByPlay from "../components/bento/PlayByPlay";
import WinProb from "../components/bento/WinProb";
import FieldDisplay from "../components/FieldDisplay";
import DriveInfo from "../components/DriveInfo";
import { GameDetails } from "../types";

type Sport = "nfl" | "college-football";
type Tab = "gamecast" | "boxscore";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  if (contentType.includes("application/json")) {
    return JSON.parse(text);
  }

  throw new Error(`Unexpected content-type: ${contentType}`);
};

export default function Game() {
  const { sport: urlSport = "nfl", id = "" } = useParams();
  const [activeTab, setActiveTab] = useState<Tab>("gamecast");

  // Map URL sport param to API sport param
  const sport: Sport = urlSport === "cfb" ? "college-football" : "nfl";

  const { data, error, isLoading } = useSWR<GameDetails>(
    id ? API.game(sport, id) : null,
    fetcher
  );

  if (isLoading) {
    return <div className="p-6 text-sm opacity-70">Loading game…</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-red-400">
        Failed to load game.
        {"\n"}
        {(error as Error).message}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-sm opacity-70">
        No game data available for this id.
      </div>
    );
  }

  const summary = data.summary;
  const situation = data.situation || null;
  const competitors = Array.isArray(summary.competitors)
    ? summary.competitors
    : [];

  const home = competitors.find((c: any) => c.homeAway === "home");
  const away = competitors.find((c: any) => c.homeAway === "away");

  const homeName = home?.team?.name ?? "Home";
  const awayName = away?.team?.name ?? "Away";

  const headerDate =
    summary.startTime && typeof summary.startTime === "string"
      ? new Date(summary.startTime)
      : null;

  const statusText: string = summary.status || "";

  // ESPN-like center line: "1:10 - 2nd" or fallback to status text
  let clockQuarterLine: string | null = null;
  if (situation?.clock && typeof situation.clock === "string") {
    let qLabel = "";
    const q = situation.period;
    if (q === 1) qLabel = "1st";
    else if (q === 2) qLabel = "2nd";
    else if (q === 3) qLabel = "3rd";
    else if (q === 4) qLabel = "4th";
    else if (typeof q === "number") qLabel = `Q${q}`;

    clockQuarterLine = qLabel ? `${situation.clock} - ${qLabel}` : situation.clock;
  } else if (statusText) {
    clockQuarterLine = statusText;
  }

  // Down & distance line (under clock)
  let downDistanceLine: string | null = null;
  if (situation) {
    const dd =
      (situation.shortDownDistanceText as string | undefined) ||
      (situation.downDistanceText as string | undefined);
    if (dd) {
      downDistanceLine = dd;
    }
  }

  // Possession indicator - determine which team has the ball
  let possessionTeamSide: "home" | "away" | null = null;
  if (situation?.possessionTeamId) {
    const possId = String(situation.possessionTeamId);
    if (home?.team?.id && String(home.team.id) === possId) {
      possessionTeamSide = "home";
    } else if (away?.team?.id && String(away.team.id) === possId) {
      possessionTeamSide = "away";
    }
  }

  // Red zone indicator
  const isRedZone = situation?.isRedZone === true;

  // Venue info
  const venue = summary.venue || null;

  // Check if game is live (for showing field display)
  const isLive = statusText && !statusText.toLowerCase().includes("final") &&
                 !statusText.toLowerCase().includes("scheduled") &&
                 situation !== null;

  return (
    <section className="space-y-5">
      {/* Top meta row: back link + date/status (ESPN-style) */}
      <div className="flex items-center justify-between gap-4">
        <Link
          to={sport === "college-football" ? "/cfb" : "/nfl"}
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition"
        >
          <span className="text-lg leading-none">←</span>
          Back to {sport === "college-football" ? "CFB" : "NFL"} scoreboard
        </Link>
        <div className="text-xs text-slate-400 text-right">
          {headerDate && (
            <span>{headerDate.toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}</span>
          )}
          {venue && (
            <>
              <span className="mx-1.5 opacity-50">•</span>
              <span>{venue}</span>
            </>
          )}
        </div>
      </div>

      {/* Score Bug */}
      <div className="card p-5">
        {/* Status badge */}
        {statusText && (
          <div className="flex justify-center mb-3">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
              statusText.toLowerCase().includes("final")
                ? "bg-slate-700 text-slate-300"
                : statusText.toLowerCase().includes("progress") || clockQuarterLine
                ? "bg-green-900/50 text-green-400"
                : "bg-slate-800 text-slate-400"
            }`}>
              {statusText}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <TeamBlock
            competitor={away}
            align="left"
            hasPossession={possessionTeamSide === "away"}
          />

          <div className="flex flex-col items-center min-w-[130px]">
            {clockQuarterLine && !statusText.toLowerCase().includes("final") && (
              <div className="text-xs font-medium text-slate-300 mb-1.5">
                {clockQuarterLine}
              </div>
            )}
            <div className="text-3xl font-bold leading-none tracking-tight">
              {(away?.score ?? "-")}
              <span className="mx-2 opacity-40 text-xl">-</span>
              {(home?.score ?? "-")}
            </div>
            {downDistanceLine && (
              <div className={`mt-2 text-[11px] flex items-center justify-center gap-1.5 ${
                isRedZone ? "text-red-400 font-medium" : "text-slate-400"
              }`}>
                {isRedZone && (
                  <span
                    className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse"
                    title="Red Zone"
                  />
                )}
                {downDistanceLine}
              </div>
            )}
          </div>

          <TeamBlock
            competitor={home}
            align="right"
            hasPossession={possessionTeamSide === "home"}
          />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-slate-700">
        <button
          onClick={() => setActiveTab("gamecast")}
          className={`px-4 py-2 text-sm font-semibold transition relative ${
            activeTab === "gamecast"
              ? "text-white"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Gamecast
          {activeTab === "gamecast" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("boxscore")}
          className={`px-4 py-2 text-sm font-semibold transition relative ${
            activeTab === "boxscore"
              ? "text-white"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Box Score
          {activeTab === "boxscore" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400" />
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "gamecast" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {/* LEFT COLUMN - Field and Analytics */}
          <div className="space-y-4">
            {/* Field Display - only show during live games */}
            {isLive && situation && (
              <FieldDisplay
                situation={situation}
                homeTeamId={home?.team?.id || ""}
                awayTeamId={away?.team?.id || ""}
                homeTeamColor={home?.team?.color ? `#${home.team.color}` : undefined}
                awayTeamColor={away?.team?.color ? `#${away.team.color}` : undefined}
                homeTeamAbbr={home?.team?.abbreviation || "HOME"}
                awayTeamAbbr={away?.team?.abbreviation || "AWAY"}
              />
            )}

            {/* Win Probability */}
            <WinProb
              winProbability={data.winProbability}
              homeTeam={homeName}
              awayTeam={awayName}
              gameStatus={statusText.toLowerCase().includes("final") ? "final" : undefined}
            />

            {/* TODO: Additional analytics can go here */}
          </div>

          {/* RIGHT COLUMN - Drive Info and Last Play */}
          {isLive && situation && (
            <div className="space-y-4">
              <DriveInfo situation={situation} plays={data.plays || []} />
            </div>
          )}
        </div>
      )}

      {activeTab === "boxscore" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
          {/* LEFT COLUMN */}
          <div className="space-y-4">
            {/* Box score */}
            <BoxScore boxscore={data.boxscore} data={data.boxscore} />

            {/* Play-by-play */}
            <PlayByPlay plays={data.plays} data={data.plays} />
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-4">
            <TeamStats teamStats={data.teamStats} data={data.teamStats} />
          </div>
        </div>
      )}
    </section>
  );
}

function TeamBlock({
  competitor,
  align,
  hasPossession = false,
}: {
  competitor: any;
  align: "left" | "right";
  hasPossession?: boolean;
}) {
  if (!competitor) {
    return (
      <div className="flex items-center gap-3 opacity-40 flex-1">
        <div className="w-12 h-12 rounded-full bg-slate-800" />
        <div className={align === "right" ? "text-right" : ""}>
          <div className="font-semibold leading-tight">Team</div>
          <div className="text-xs opacity-60">-</div>
        </div>
      </div>
    );
  }

  const team = competitor.team ?? {};
  const containerClass =
    align === "right"
      ? "flex items-center gap-3 justify-end text-right flex-1"
      : "flex items-center gap-3 flex-1";

  // Possession indicator - subtle amber dot
  const PossessionIndicator = () => (
    <span
      className="inline-block w-2 h-2 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50"
      title="Has possession"
    />
  );

  return (
    <div className={containerClass}>
      {align === "left" && (
        <>
          {hasPossession && <PossessionIndicator />}
          {team.logo && (
            <img
              src={team.logo}
              alt={team.name ?? "Team logo"}
              className="w-12 h-12 rounded-full object-contain bg-slate-800/50"
            />
          )}
        </>
      )}
      <div className={align === "right" ? "order-first" : ""}>
        <div className={`font-semibold leading-tight flex items-center gap-1.5 ${
          align === "right" ? "justify-end" : ""
        }`}>
          {align === "right" && hasPossession && <PossessionIndicator />}
          {team.rank && (
            <span className="text-xs font-bold text-amber-400 px-1.5 py-0.5 bg-amber-400/10 rounded">
              #{team.rank}
            </span>
          )}
          <span>{team.name ?? "Team"}</span>
        </div>
        <div className="text-xs text-slate-400 mt-0.5">
          {team.record && <span>{team.record}</span>}
          {team.record && (
            <span className="opacity-60">
              {competitor.homeAway === "home" ? " • Home" : " • Away"}
            </span>
          )}
        </div>
      </div>
      {align === "right" && team.logo && (
        <img
          src={team.logo}
          alt={team.name ?? "Team logo"}
          className="w-12 h-12 rounded-full object-contain bg-slate-800/50"
        />
      )}
    </div>
  );
}
