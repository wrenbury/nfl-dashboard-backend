import React, { useEffect, useState } from "react";
import { GameLiveResponse, TeamSide } from "../types/api";

interface GameDashboardProps {
  gameId: string;
  onBack: () => void;
}

type FetchState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "success"; data: T };

export const GameDashboard: React.FC<GameDashboardProps> = ({ gameId, onBack }) => {
  const [state, setState] = useState<FetchState<GameLiveResponse>>({
    status: "idle"
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setState({ status: "loading" });
      try {
        import { fetchGameLive } from "../api";
        if (!res.ok) {
          const msg = `HTTP ${res.status}`;
          throw new Error(msg);
        }
        const json: GameLiveResponse = await res.json();
        if (!cancelled) {
          setState({ status: "success", data: json });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            error: err instanceof Error ? err.message : "Unknown error"
          });
        }
      }
    };

    load();

    const interval = setInterval(load, 10_000); // poll every 10s

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [gameId]);

  return (
    <section className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <button
            onClick={onBack}
            className="mb-2 inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            ← Back to Today&apos;s Games
          </button>
          <h2 className="text-base font-semibold tracking-tight">
            Game Dashboard
          </h2>
          <p className="text-xs text-slate-400">
            Live header, scoring, drives, and box score in a bento layout.
          </p>
        </div>

        <div className="text-xs text-slate-400">
          Game ID:{" "}
          <span className="font-mono text-slate-300">{gameId}</span>
        </div>
      </div>

      {state.status === "loading" || state.status === "idle" ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          Loading game...
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <p className="text-sm text-red-400">
            Failed to load game: {state.error}
          </p>
          <p className="text-xs text-slate-500">
            Check that the backend is running and the game ID is valid.
          </p>
        </div>
      ) : null}

      {state.status === "success" ? (
        <BentoLayout data={state.data} />
      ) : null}
    </section>
  );
};

interface BentoProps {
  data: GameLiveResponse;
}

const BentoLayout: React.FC<BentoProps> = ({ data }) => {
  const { header, scoring, boxscore, meta, analytics } = data;
  const home = header.home_team;
  const away = header.away_team;

  return (
    <div className="grid gap-4 md:grid-cols-3 md:auto-rows-[minmax(0,1fr)]">
      {/* Header & score */}
      <div className="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-slate-400">
              {header.league} • Season {header.season}
              {header.week != null && ` • Week ${header.week}`}
            </div>
            <h3 className="text-base font-semibold tracking-tight">
              {away.full_name} @ {home.full_name}
            </h3>
            {meta.venue.name && (
              <div className="mt-1 text-xs text-slate-500">
                {meta.venue.name}
                {meta.venue.city && ` • ${meta.venue.city}`}
                {meta.venue.state && `, ${meta.venue.state}`}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end text-xs text-slate-400">
            {meta.broadcast.network && (
              <div>Broadcast: {meta.broadcast.network}</div>
            )}
            {header.last_updated_utc && (
              <div className="mt-1">
                Last update:{" "}
                <span className="font-mono text-[11px]">
                  {new Date(header.last_updated_utc).toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 items-center gap-4">
          <TeamScoreBlock team={away} side="away" header={header} />
          <div className="flex flex-col items-center justify-center gap-1 text-xs text-slate-300">
            <span className="rounded-full bg-slate-800 px-3 py-1 text-[11px] uppercase tracking-wide">
              {header.status.toUpperCase()}
            </span>
            {header.status === "in" && (
              <>
                <span className="text-[11px]">
                  Q{header.quarter ?? "-"} • {header.clock ?? "--:--"}
                </span>
                {header.down && header.distance && (
                  <span className="text-[11px] text-slate-400">
                    {ordinal(header.down)} &amp; {header.distance} at{" "}
                    {header.yard_line ?? "—"}
                  </span>
                )}
                {header.possession && (
                  <span className="text-[11px] text-emerald-400">
                    Possession: {header.possession.toUpperCase()}
                  </span>
                )}
                {header.red_zone && (
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                    RED ZONE
                  </span>
                )}
              </>
            )}
            {header.last_play_short && (
              <p className="mt-2 max-w-xs text-center text-[11px] text-slate-400">
                Last play: {header.last_play_short}
              </p>
            )}
          </div>
          <TeamScoreBlock team={home} side="home" header={header} />
        </div>
      </div>

      {/* Scoring summary */}
      <div className="md:row-span-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm flex flex-col">
        <h3 className="mb-2 text-sm font-semibold">Scoring Summary</h3>

        <div className="mb-3 rounded-xl border border-slate-800 bg-slate-900/70 p-2 text-[11px]">
          <div className="mb-1 flex items-center justify-between text-slate-400">
            <span>Quarter</span>
            <span className="w-10 text-center">{away.abbreviation}</span>
            <span className="w-10 text-center">{home.abbreviation}</span>
          </div>
          <div className="space-y-0.5">
            {scoring.summary_by_quarter.length === 0 && (
              <div className="py-2 text-center text-slate-500">
                No scoring yet.
              </div>
            )}
            {scoring.summary_by_quarter.map((q) => (
              <div
                key={q.quarter}
                className="flex items-center justify-between rounded-lg px-1 py-1 text-slate-200"
              >
                <span className="w-14 text-xs text-slate-400">
                  Q{q.quarter}
                </span>
                <span className="w-10 text-center text-sm">
                  {q.away_points}
                </span>
                <span className="w-10 text-center text-sm">
                  {q.home_points}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <h4 className="mb-1 text-[11px] font-medium text-slate-400">
            Scoring plays
          </h4>
          <div className="h-full space-y-1 overflow-y-auto pr-1 text-[11px] scrollbar-thin">
            {scoring.plays.length === 0 && (
              <div className="py-4 text-center text-slate-500 text-xs">
                No scoring plays recorded.
              </div>
            )}
            {scoring.plays.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5"
              >
                <div className="mb-0.5 flex items-center justify-between">
                  <span className="font-semibold text-slate-200">
                    {p.team.toUpperCase()} • {p.type}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Q{p.quarter} • {p.clock}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">{p.description}</p>
                <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-500">
                  <span>
                    {p.player_primary && <span>{p.player_primary}</span>}
                    {p.player_primary && p.yards != null && " • "}
                    {p.yards != null && <span>{p.yards} yds</span>}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Team stats */}
      <div className="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold">Team Stats</h3>
        <TeamStatsTable data={boxscore.team_stats} home={home.abbreviation} away={away.abbreviation} />
      </div>

      {/* Player stats */}
      <div className="md:col-span-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold">Player Leaders</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <PlayerStatsColumn
            title="Passing"
            rows={boxscore.player_stats.passing.map((p) => ({
              label: p.player,
              team: p.team,
              line: `${p.completions}/${p.attempts}, ${p.yards} yds, ${p.touchdowns} TD, ${p.interceptions} INT`
            }))}
          />
          <PlayerStatsColumn
            title="Rushing"
            rows={boxscore.player_stats.rushing.map((p) => ({
              label: p.player,
              team: p.team,
              line: `${p.carries} car, ${p.yards} yds, ${p.touchdowns} TD`
            }))}
          />
          <PlayerStatsColumn
            title="Receiving"
            rows={boxscore.player_stats.receiving.map((p) => ({
              label: p.player,
              team: p.team,
              line: `${p.receptions} rec, ${p.yards} yds, ${p.touchdowns} TD`
            }))}
          />
        </div>
      </div>

      {/* Analytics & weather */}
      <div className="md:col-span-3 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold">Weather</h3>
          <p className="text-xs text-slate-300">
            {meta.weather.description ?? "No weather data."}
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-slate-400">
            <div>
              <div className="text-slate-500">Temp</div>
              <div>{meta.weather.temperature_f ?? "—"} °F</div>
            </div>
            <div>
              <div className="text-slate-500">Wind</div>
              <div>{meta.weather.wind_mph ?? "—"} mph</div>
            </div>
            <div>
              <div className="text-slate-500">Humidity</div>
              <div>{meta.weather.humidity_pct ?? "—"}%</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold">Win Probability</h3>
          <p className="text-xs text-slate-400 mb-1">
            (Stubbed — coming soon)
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-300">
            <div>
              <div className="text-slate-500 mb-1">{away.abbreviation}</div>
              <div className="text-lg font-semibold">
                {analytics.win_probability.away != null
                  ? `${Math.round(analytics.win_probability.away * 100)}%`
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-slate-500 mb-1 text-right">
                {home.abbreviation}
              </div>
              <div className="text-right text-lg font-semibold">
                {analytics.win_probability.home != null
                  ? `${Math.round(analytics.win_probability.home * 100)}%`
                  : "—"}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold">Team Success Rates</h3>
          <div className="mt-1 grid grid-cols-2 gap-3 text-[11px] text-slate-300">
            <TeamSuccessBlock
              label={away.abbreviation}
              data={analytics.team_success_rates.away}
            />
            <TeamSuccessBlock
              label={home.abbreviation}
              data={analytics.team_success_rates.home}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const TeamScoreBlock: React.FC<{
  team: GameLiveResponse["header"]["home_team"];
  side: TeamSide;
  header: GameLiveResponse["header"];
}> = ({ team, side, header }) => {
  const isPossession =
    header.possession != null && header.possession.toLowerCase() === side;

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-xs font-bold">
            {team.abbreviation}
          </div>
          <div className="leading-tight">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">
              {side === "home" ? "Home" : "Away"}
            </div>
            <div className="text-sm font-semibold line-clamp-1">
              {team.full_name}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isPossession && (
            <span className="text-xs text-amber-400">●</span>
          )}
          <div className="text-xl font-semibold">{team.score}</div>
        </div>
      </div>
      {team.record && (
        <div className="text-[11px] text-slate-500">Record: {team.record}</div>
      )}
    </div>
  );
};

const TeamStatsTable: React.FC<{
  data: GameLiveResponse["boxscore"]["team_stats"];
  home: string;
  away: string;
}> = ({ data, home, away }) => {
  const rows: { label: string; key: keyof typeof data.home }[] = [
    { label: "Total Yards", key: "total_yards" },
    { label: "Plays", key: "plays" },
    { label: "Yards / Play", key: "yards_per_play" },
    { label: "Passing Yards", key: "passing_yards" },
    { label: "Rushing Yards", key: "rushing_yards" },
    { label: "Turnovers", key: "turnovers" },
    { label: "Penalties", key: "penalties" },
    { label: "Penalty Yds", key: "penalty_yards" },
    { label: "3rd Down Made", key: "third_down_made" },
    { label: "3rd Down Att", key: "third_down_attempts" },
    { label: "Red Zone Trips", key: "red_zone_trips" },
    { label: "Red Zone TDs", key: "red_zone_tds" },
    { label: "Time of Possession", key: "time_of_possession" }
  ];

  const formatValue = (value: unknown) => {
    if (value == null) return "—";
    if (typeof value === "number") return value.toString();
    return String(value);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800">
      <table className="min-w-full text-xs">
        <thead className="bg-slate-900/80">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-slate-400">
              Stat
            </th>
            <th className="px-3 py-2 text-right font-medium text-slate-400">
              {away}
            </th>
            <th className="px-3 py-2 text-right font-medium text-slate-400">
              {home}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 bg-slate-950/50">
          {rows.map((row) => (
            <tr key={row.key as string}>
              <td className="px-3 py-1.5 text-slate-300">{row.label}</td>
              <td className="px-3 py-1.5 text-right text-slate-200">
                {formatValue(data.away[row.key])}
              </td>
              <td className="px-3 py-1.5 text-right text-slate-200">
                {formatValue(data.home[row.key])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface PlayerRow {
  label: string;
  team: TeamSide;
  line: string;
}

const PlayerStatsColumn: React.FC<{
  title: string;
  rows: PlayerRow[];
}> = ({ title, rows }) => {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs">
      <h4 className="mb-2 text-[11px] font-semibold text-slate-300">
        {title}
      </h4>
      {rows.length === 0 && (
        <p className="text-[11px] text-slate-500">No stats yet.</p>
      )}
      <div className="space-y-1.5">
        {rows.map((row, idx) => (
          <div
            key={`${row.label}-${idx}`}
            className="rounded-lg bg-slate-900/80 px-2 py-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-100">
                {row.label}
              </span>
              <span className="text-[10px] text-slate-500">
                {row.team.toUpperCase()}
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-slate-300">
              {row.line}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TeamSuccessBlock: React.FC<{
  label: string;
  data: GameLiveResponse["analytics"]["team_success_rates"]["home"];
}> = ({ label, data }) => {
  const formatPct = (val?: number | null) =>
    val != null ? `${Math.round(val * 100)}%` : "—";
  const formatNum = (val?: number | null) =>
    val != null ? val.toFixed(2) : "—";

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
      <div className="mb-1 text-[11px] font-semibold text-slate-200">
        {label}
      </div>
      <div className="space-y-0.5 text-[11px] text-slate-400">
        <div className="flex justify-between">
          <span>Success rate</span>
          <span className="text-slate-200">{formatPct(data.success_rate)}</span>
        </div>
        <div className="flex justify-between">
          <span>Explosive rate</span>
          <span className="text-slate-200">
            {formatPct(data.explosive_play_rate)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>EPA / play</span>
          <span className="text-slate-200">{formatNum(data.epa_per_play)}</span>
        </div>
      </div>
    </div>
  );
};

const ordinal = (n: number): string => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
