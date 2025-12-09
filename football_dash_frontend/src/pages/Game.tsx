// football_dash_frontend/src/pages/Game.tsx

import { useParams, Link } from "react-router-dom";
import useSWR from "swr";
import { API } from "../api";
import BoxScore from "../components/bento/BoxScore";
import TeamStats from "../components/bento/TeamStats";
import PlayByPlay from "../components/bento/PlayByPlay";
import WinProb from "../components/bento/WinProb";

type Sport = "nfl" | "college-football";

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
  const { sport = "nfl", id = "" } = useParams();
  const { data, error, isLoading } = useSWR(
    id ? API.game(sport as Sport, id) : null,
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

  return (
    <section className="space-y-6">
      {/* Top meta row: back link + date/status (ESPN-style) */}
      <div className="flex items-center justify-between gap-4">
        <Link
          to={sport === "college-football" ? "/college-football" : "/nfl"}
          className="inline-flex text-sm opacity-70 hover:opacity-100 transition"
        >
          ← Back to {sport === "college-football" ? "CFB" : "NFL"} scoreboard
        </Link>
        <div className="text-xs opacity-70 text-right">
          {headerDate && (
            <span>{headerDate.toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}</span>
          )}
          {headerDate && statusText && <span> • </span>}
          {statusText && <span>{statusText}</span>}
        </div>
      </div>

      {/* Main bento: left stack vs right stack */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
        {/* LEFT COLUMN */}
        <div className="space-y-4">
          {/* ESPN-style game header card */}
          <div className="card flex flex-col gap-3">
            <div className="flex items-center justify-between gap-6">
              <TeamBlock competitor={away} align="left" />
              <div className="flex flex-col items-center min-w-[120px]">
                {clockQuarterLine && (
                  <div className="text-xs font-semibold mb-1">
                    {clockQuarterLine}
                  </div>
                )}
                <div className="text-2xl font-semibold leading-none mb-1">
                  {(away?.score ?? "-")}{" "}
                  <span className="opacity-60 text-base">:</span>{" "}
                  {(home?.score ?? "-")}
                </div>
                {downDistanceLine && (
                  <div className="text-[11px] opacity-80">
                    {downDistanceLine}
                  </div>
                )}
              </div>
              <TeamBlock competitor={home} align="right" />
            </div>
          </div>

          {/* Box score */}
          <BoxScore boxscore={data.boxscore} data={data.boxscore} />

          {/* Play-by-play */}
          <PlayByPlay plays={data.plays} data={data.plays} />
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-4">
          <WinProb
            winProbability={data.winProbability}
            homeTeam={homeName}
            awayTeam={awayName}
          />
          <TeamStats teamStats={data.teamStats} data={data.teamStats} />
        </div>
      </div>
    </section>
  );
}

function TeamBlock({ competitor, align }: { competitor: any; align: "left" | "right" }) {
  if (!competitor) {
    return (
      <div className="flex items-center gap-3 opacity-40">
        <div className="w-10 h-10 rounded-full bg-slate-800" />
        <div className={align === "right" ? "text-right" : ""}>
          <div className="font-semibold leading-tight">Team</div>
          <div className="text-xs opacity-60">—</div>
        </div>
      </div>
    );
  }

  const team = competitor.team ?? {};
  const containerClass =
    align === "right"
      ? "flex items-center gap-3 justify-end text-right"
      : "flex items-center gap-3";

  return (
    <div className={containerClass}>
      {align === "left" && team.logo && (
        <img
          src={team.logo}
          alt={team.name ?? "Team logo"}
          className="w-10 h-10 rounded-full"
        />
      )}
      <div>
        <div className="font-semibold leading-tight">
          {team.name ?? "Team"}
        </div>
        <div className="text-xs opacity-60">
          {team.record ?? ""}
          {team.record && competitor.homeAway === "home" ? " • Home" : ""}
          {team.record && competitor.homeAway === "away" ? " • Away" : ""}
        </div>
      </div>
      {align === "right" && team.logo && (
        <img
          src={team.logo}
          alt={team.name ?? "Team logo"}
          className="w-10 h-10 rounded-full"
        />
      )}
    </div>
  );
}
