// football_dash_frontend/src/components/bento/WinProb.tsx

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
} from "recharts";

type Props = {
  winProbability: any;
  homeTeam?: string;
  awayTeam?: string;
  homeTeamId?: string;
  awayTeamId?: string;
  league?: string;
  gameStatus?: string; // "pre", "in", "final", "post", etc.
  situation?: any; // Current game situation with clock, period info
};

type RawWinProbPoint = {
  homeWinPercentage?: number;
  homeWinProb?: number;
  period?: number | { number?: number };
  secondsLeft?: number;
  secondsRemaining?: number;
  clock?: string | number;
  playId?: string;
};

type NormalizedPoint = {
  t: number; // 0..1 game progression
  q: number | null; // quarter / period
  home: number; // 0..100 (home WP)
  away: number; // 0..100 (away WP)
  secondsLeft: number | null;
};

const TOTAL_REG_SECONDS = 60 * 60; // 4 * 15 minutes
const QUARTER_SECONDS = 15 * 60; // 15 minutes per quarter

function parseClockToSecondsRemaining(clock: string | number | undefined): number | null {
  if (clock == null) return null;
  if (typeof clock === "number") return clock;
  const parts = clock.split(":");
  if (parts.length !== 2) return null;
  const mm = parseInt(parts[0]!, 10);
  const ss = parseInt(parts[1]!, 10);
  if (Number.isNaN(mm) || Number.isNaN(ss)) return null;
  return mm * 60 + ss;
}

function normalizeWinProb(raw: any): NormalizedPoint[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const out: NormalizedPoint[] = [];

  raw.forEach((wp: RawWinProbPoint, index: number) => {
    const prob =
      typeof wp.homeWinPercentage === "number"
        ? wp.homeWinPercentage
        : typeof wp.homeWinProb === "number"
        ? wp.homeWinProb
        : null;

    if (prob == null) return;

    // period / quarter
    let periodNum: number | null = null;
    if (typeof wp.period === "number") {
      periodNum = wp.period;
    } else if (wp.period && typeof wp.period === "object") {
      const maybe = (wp.period as any).number;
      if (typeof maybe === "number") {
        periodNum = maybe;
      }
    }

    // primary: secondsLeft / secondsRemaining over whole game
    let t: number | null = null;
    let secondsLeft: number | null = null;
    if (typeof wp.secondsLeft === "number") {
      secondsLeft = wp.secondsLeft;
    } else if (typeof wp.secondsRemaining === "number") {
      secondsLeft = wp.secondsRemaining;
    }

    if (secondsLeft != null) {
      // Handle overtime: if secondsLeft is negative or period > 4
      if (periodNum && periodNum > 4) {
        // Overtime - extend beyond 1.0
        const otElapsed = QUARTER_SECONDS - (secondsLeft % QUARTER_SECONDS);
        t = 1.0 + (otElapsed / QUARTER_SECONDS) * 0.1; // OT takes 10% extra
      } else {
        const clamped = Math.max(0, Math.min(TOTAL_REG_SECONDS, secondsLeft));
        const elapsed = TOTAL_REG_SECONDS - clamped;
        t = elapsed / TOTAL_REG_SECONDS;
      }
    } else {
      // secondary: derive from period + in-quarter clock
      const secRemainingInPeriod = parseClockToSecondsRemaining(wp.clock);
      if (periodNum != null && secRemainingInPeriod != null) {
        if (periodNum > 4) {
          // Overtime
          const elapsedInOT = QUARTER_SECONDS - secRemainingInPeriod;
          t = 1.0 + (elapsedInOT / QUARTER_SECONDS) * 0.1;
        } else {
          const elapsedInPeriod = QUARTER_SECONDS - secRemainingInPeriod;
          const baseElapsedBefore = (periodNum - 1) * QUARTER_SECONDS;
          const totalElapsed = baseElapsedBefore + elapsedInPeriod;
          t = totalElapsed / TOTAL_REG_SECONDS;
        }
      }
    }

    // fallback: evenly spaced
    if (t == null) {
      t = raw.length > 1 ? index / (raw.length - 1) : 0;
    }

    if (!Number.isFinite(t)) t = 0;
    if (t < 0) t = 0;

    const homeWP = Math.max(0, Math.min(100, prob * 100));
    out.push({
      t,
      q: periodNum,
      home: homeWP,
      away: 100 - homeWP,
      secondsLeft,
    });
  });

  if (!out.length) return [];

  // Sort by time to ensure proper rendering
  out.sort((a, b) => a.t - b.t);

  return out;
}

// Quarter divider positions (boundaries between quarters) - ESPN always shows all 4
const QUARTER_DIVIDERS = [0.25, 0.5, 0.75];

// ESPN-style quarter tick positions (center of each quarter) - ESPN always shows all 4
const QUARTER_TICKS = [0.125, 0.375, 0.625, 0.875];

function formatQuarterTick(x: number): string {
  if (Math.abs(x - 0.125) < 0.01) return "1st";
  if (Math.abs(x - 0.375) < 0.01) return "2nd";
  if (Math.abs(x - 0.625) < 0.01) return "3rd";
  if (Math.abs(x - 0.875) < 0.01) return "4th";
  if (x > 1.0) return "OT";
  return "";
}

// ESPN-style vertical labels: team labels at top and bottom
function formatYAxisTick(v: number): string {
  if (v === 100) return "100";
  if (v === 50) return "50";
  if (v === 0) return "100";
  return "";
}

// Generate team logo URL using ESPN combiner API
function getTeamLogoUrl(teamId: string | undefined, league: string = "nfl"): string | null {
  if (!teamId) return null;
  // CFB uses 'ncaa' path instead of 'college-football'
  const leaguePath = league === "college-football" ? "ncaa" : league;
  return `https://a.espncdn.com/combiner/i?img=/i/teamlogos/${leaguePath}/500/${teamId}.png&h=40&w=40`;
}

export default function WinProb({
  winProbability,
  homeTeam = "Home",
  awayTeam = "Away",
  homeTeamId,
  awayTeamId,
  league = "nfl",
  gameStatus,
  situation,
}: Props) {
  const data = normalizeWinProb(winProbability);

  if (!data.length) {
    return (
      <div className="card flex flex-col justify-center">
        <div className="text-sm font-semibold mb-1">Win Probability</div>
        <div className="text-xs opacity-70">
          Win probability data is not available for this game.
        </div>
      </div>
    );
  }

  const lastPoint = data[data.length - 1]!;
  const lastT = lastPoint.t || 0;

  // Calculate current game time from situation if available (for live games)
  let currentGameTime: number | null = null;
  if (situation && gameStatus !== "final" && gameStatus !== "post") {
    const period = situation.period;
    const clock = situation.clock;

    if (typeof period === "number" && clock) {
      const secondsRemainingInPeriod = parseClockToSecondsRemaining(clock);
      if (secondsRemainingInPeriod !== null) {
        if (period > 4) {
          // Overtime
          const elapsedInOT = QUARTER_SECONDS - secondsRemainingInPeriod;
          currentGameTime = 1.0 + (elapsedInOT / QUARTER_SECONDS) * 0.1;
        } else {
          // Regular time
          const elapsedInPeriod = QUARTER_SECONDS - secondsRemainingInPeriod;
          const baseElapsedBefore = (period - 1) * QUARTER_SECONDS;
          const totalElapsed = baseElapsedBefore + elapsedInPeriod;
          currentGameTime = totalElapsed / TOTAL_REG_SECONDS;
        }
      }
    }
  }

  // Set domain to actual game progress (don't extend to full game during live games)
  // Use current game time if available, otherwise use last data point
  let domainMax: number;
  if (currentGameTime !== null) {
    // Live game with situation data - show only up to current time plus small buffer
    domainMax = Math.min(currentGameTime + 0.05, 1.1); // Add 5% buffer, cap at 1.1
  } else if (gameStatus === "final" || gameStatus === "post") {
    // Completed game - show full domain
    domainMax = lastT > 1 ? lastT : 1.0;
  } else {
    // Live game without situation data - use last data point, don't assume full game
    domainMax = Math.max(lastT, 0.1); // Use last data point time
  }

  const homePct = lastPoint.home;
  const awayPct = lastPoint.away;
  const homePctLabel = `${homePct.toFixed(0)}%`;
  const awayPctLabel = `${awayPct.toFixed(0)}%`;

  // Determine if game is finished (for end-game fill)
  const isGameComplete = gameStatus === "final" || gameStatus === "post" || lastT >= 1;
  const homeWins = homePct > 50;

  // ESPN always shows all 4 quarter labels, even for live games
  // The data line stops at current time, but X-axis shows full game
  const visibleQuarterTicks = [...QUARTER_TICKS];
  if (domainMax > 1.0) {
    // Add OT tick if overtime
    visibleQuarterTicks.push(1.05);
  }

  // Get the "End Game" time label
  const lastQuarter = lastPoint.q;
  let endLabel = "End Game";
  if (lastQuarter === 1) endLabel = "End 1st";
  else if (lastQuarter === 2) endLabel = "End 2nd";
  else if (lastQuarter === 3) endLabel = "End 3rd";
  else if (lastQuarter === 4) endLabel = "End 4th";
  else if (lastQuarter && lastQuarter > 4) endLabel = "End OT";

  const awayLogoUrl = getTeamLogoUrl(awayTeamId, league);
  const homeLogoUrl = getTeamLogoUrl(homeTeamId, league);

  return (
    <div className="card flex flex-col">
      {/* Header row with team logos, names and percentages */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold">Win Probability</div>
        <div className="flex items-center gap-6 text-xs uppercase tracking-wide">
          <div className="flex items-center gap-2">
            {awayLogoUrl && (
              <img
                src={awayLogoUrl}
                alt={awayTeam}
                className="w-8 h-8 object-contain"
              />
            )}
            <div className="flex flex-col items-center">
              <span className="opacity-60">{awayTeam}</span>
              <span className={`text-base font-semibold ${!homeWins && isGameComplete ? "text-green-400" : ""}`}>
                {awayPctLabel}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {homeLogoUrl && (
              <img
                src={homeLogoUrl}
                alt={homeTeam}
                className="w-8 h-8 object-contain"
              />
            )}
            <div className="flex flex-col items-center">
              <span className="opacity-60">{homeTeam}</span>
              <span className={`text-base font-semibold ${homeWins && isGameComplete ? "text-green-400" : ""}`}>
                {homePctLabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="h-52 relative">
        <ResponsiveContainer width="100%" height="100%" minHeight={208}>
          <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <defs>
              {/* ESPN-style split gradients */}
              {/* Home team gradient (above 50%) - fills from 50% to top */}
              <linearGradient id="homeWpGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
              </linearGradient>
              {/* Away team gradient (below 50%) - fills from 50% to bottom */}
              <linearGradient id="awayWpGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.05} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0.5} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />

            {/* Quarter divider lines */}
            {QUARTER_DIVIDERS.map((d) => (
              <ReferenceLine
                key={`divider-${d}`}
                x={d}
                stroke="#475569"
                strokeDasharray="2 2"
                opacity={0.5}
              />
            ))}

            <XAxis
              dataKey="t"
              type="number"
              domain={[0, 1.0]}
              ticks={visibleQuarterTicks}
              tickFormatter={formatQuarterTick}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={{ stroke: "#334155" }}
              tickLine={{ stroke: "#334155" }}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 50, 100]}
              tickFormatter={formatYAxisTick}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              width={28}
              axisLine={{ stroke: "#334155" }}
              tickLine={{ stroke: "#334155" }}
            />

            {/* Center 50% reference line */}
            <ReferenceLine y={50} stroke="#64748b" strokeDasharray="4 4" />

            {/* Away team area (below 50%) - with dashed line */}
            <Area
              type="monotone"
              dataKey="away"
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="4 4"
              fill="url(#awayWpGradient)"
              fillOpacity={1}
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 4, fill: "#ef4444", stroke: "#fff", strokeWidth: 2 }}
              baseLine={50}
            />

            {/* Home team area (above 50%) - solid line */}
            <Area
              type="monotone"
              dataKey="home"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#homeWpGradient)"
              fillOpacity={1}
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 4, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }}
              baseLine={50}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0]?.payload;
                if (!point) return null;

                const homeWp = point.home;
                const awayWp = point.away;
                const q = point.q;

                let qLabel = "";
                if (q === 1) qLabel = "1st Qtr";
                else if (q === 2) qLabel = "2nd Qtr";
                else if (q === 3) qLabel = "3rd Qtr";
                else if (q === 4) qLabel = "4th Qtr";
                else if (q && q > 4) qLabel = "OT";

                let clockLabel = "";
                if (point.secondsLeft != null) {
                  const mins = Math.floor(point.secondsLeft / 60);
                  const secs = point.secondsLeft % 60;
                  clockLabel = `${mins}:${secs.toString().padStart(2, "0")}`;
                }

                // Format quarter label
                let quarterLabel = "";
                if (point.q) {
                  if (point.q === 1) quarterLabel = "1st Quarter";
                  else if (point.q === 2) quarterLabel = "2nd Quarter";
                  else if (point.q === 3) quarterLabel = "3rd Quarter";
                  else if (point.q === 4) quarterLabel = "4th Quarter";
                  else if (point.q > 4) quarterLabel = `OT ${point.q - 4}`;
                }

                // Format time remaining
                let timeLabel = "";
                if (point.secondsLeft !== null && point.secondsLeft !== undefined) {
                  const minutes = Math.floor(point.secondsLeft / 60);
                  const seconds = point.secondsLeft % 60;
                  timeLabel = `${minutes}:${seconds.toString().padStart(2, "0")} remaining`;
                }

                // Calculate swing from 50%
                const homeSwing = point.home - 50;
                const swingText = homeSwing > 0
                  ? `${homeTeam} +${Math.abs(homeSwing).toFixed(1)}%`
                  : homeSwing < 0
                  ? `${awayTeam} +${Math.abs(homeSwing).toFixed(1)}%`
                  : "Even";

                return (
                  <div className="bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-lg px-4 py-3 shadow-xl min-w-[200px]">
                    {/* Quarter and time header */}
                    {quarterLabel && (
                      <div className="text-xs font-semibold text-slate-300 mb-2 pb-2 border-b border-slate-700">
                        {quarterLabel}
                        {timeLabel && <div className="text-xs text-slate-400 font-normal mt-0.5">{timeLabel}</div>}
                      </div>
                    )}

                    {/* Win probabilities */}
                    <div className="space-y-1.5 mb-2">
                      <div className="flex items-center justify-between gap-6">
                        <span className="text-sm text-slate-300">{homeTeam}</span>
                        <span className="text-base font-bold text-blue-400">{homeWp.toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center justify-between gap-6">
                        <span className="text-sm text-slate-300">{awayTeam}</span>
                        <span className="text-base font-bold text-red-400">{awayWp.toFixed(1)}%</span>
                      </div>
                    </div>

                    {/* Advantage indicator */}
                    <div className="pt-2 border-t border-slate-700">
                      <div className="text-xs text-slate-400">
                        Advantage: <span className="text-slate-200 font-medium">{swingText}</span>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Y-axis team labels */}
        <div className="absolute left-0 top-4 text-[9px] text-slate-400 uppercase tracking-wider">
          {homeTeam}
        </div>
        <div className="absolute left-0 bottom-4 text-[9px] text-slate-400 uppercase tracking-wider">
          {awayTeam}
        </div>
      </div>

      {/* Footer with end game info */}
      <div className="mt-2 flex items-center justify-between text-[10px]">
        {isGameComplete && (
          <span className="text-slate-400">
            {endLabel}: {lastPoint.home > 50 ? homeTeam : awayTeam} {Math.abs(lastPoint.home - 50) > 49 ? "wins" : "leads"}
          </span>
        )}
        <span className="opacity-40 ml-auto">According to ESPN Analytics</span>
      </div>
    </div>
  );
}
