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
  gameStatus?: string; // "pre", "in", "final", "post", etc.
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

// Quarter divider positions (boundaries between quarters)
const QUARTER_DIVIDERS = [0.25, 0.5, 0.75];

// ESPN-style quarter tick positions (center of each quarter)
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

export default function WinProb({
  winProbability,
  homeTeam = "Home",
  awayTeam = "Away",
  gameStatus,
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
  const lastT = lastPoint.t || 1;
  const domainMax = Math.max(1, lastT);

  const homePct = lastPoint.home;
  const awayPct = lastPoint.away;
  const homePctLabel = `${homePct.toFixed(0)}%`;
  const awayPctLabel = `${awayPct.toFixed(0)}%`;

  // Determine if game is finished (for end-game fill)
  const isGameComplete = gameStatus === "final" || gameStatus === "post" || lastT >= 1;
  const homeWins = homePct > 50;

  // Calculate ticks based on game progress
  const visibleQuarterTicks = QUARTER_TICKS.filter((t) => t <= domainMax);
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

  return (
    <div className="card flex flex-col">
      {/* Header row with team names and percentages */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold">Win Probability</div>
        <div className="flex items-center gap-6 text-xs uppercase tracking-wide">
          <div className="flex flex-col items-center">
            <span className="opacity-60">{awayTeam}</span>
            <span className={`text-base font-semibold ${!homeWins && isGameComplete ? "text-green-400" : ""}`}>
              {awayPctLabel}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="opacity-60">{homeTeam}</span>
            <span className={`text-base font-semibold ${homeWins && isGameComplete ? "text-green-400" : ""}`}>
              {homePctLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="h-52 relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <defs>
              {/* Gradient for home team win probability area */}
              <linearGradient id="homeWpGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="50%" stopColor="#3b82f6" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              {/* Gradient for away team (below 50%) */}
              <linearGradient id="awayWpGradient" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                <stop offset="50%" stopColor="#ef4444" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />

            {/* Quarter divider lines */}
            {QUARTER_DIVIDERS.filter((d) => d <= domainMax).map((d) => (
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
              domain={[0, domainMax]}
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

            {/* Home team area fill (above 50%) */}
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

                const homeWP = point.home.toFixed(1);
                const awayWP = point.away.toFixed(1);

                return (
                  <div className="bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-lg px-4 py-3 shadow-xl">
                    <div className="text-xs text-slate-400 mb-2 font-medium">
                      Win Probability
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-slate-300">{homeTeam} WP</span>
                        <span className="text-sm font-bold text-blue-400">{homeWP}%</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-slate-300">{awayTeam} WP</span>
                        <span className="text-sm font-bold text-red-400">{awayWP}%</span>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Y-axis team labels */}
        <div className="absolute left-0 top-1 text-[9px] text-slate-400 uppercase tracking-wider">
          {homeTeam}
        </div>
        <div className="absolute left-0 bottom-1 text-[9px] text-slate-400 uppercase tracking-wider">
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
