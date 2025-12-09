// football_dash_frontend/src/components/bento/WinProb.tsx

import {
  ResponsiveContainer,
  LineChart,
  Line,
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
};

type RawWinProbPoint = {
  homeWinPercentage?: number;
  homeWinProb?: number;
  period?: number | { number?: number };
  secondsLeft?: number;
  secondsRemaining?: number;
  clock?: string | number;
};

type NormalizedPoint = {
  t: number; // 0..1 game progression
  q: number | null; // quarter / period
  home: number; // 0..100 (home WP)
};

const TOTAL_REG_SECONDS = 60 * 60; // 4 * 15 minutes

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
      const clamped = Math.max(0, Math.min(TOTAL_REG_SECONDS, secondsLeft));
      const elapsed = TOTAL_REG_SECONDS - clamped;
      t = elapsed / TOTAL_REG_SECONDS;
    } else {
      // secondary: derive from period + in-quarter clock
      const secRemainingInPeriod = parseClockToSecondsRemaining(wp.clock);
      if (periodNum != null && secRemainingInPeriod != null) {
        const periodLength = 15 * 60;
        const elapsedInPeriod = periodLength - secRemainingInPeriod;
        const baseElapsedBefore = (periodNum - 1) * periodLength;
        const totalElapsed = baseElapsedBefore + elapsedInPeriod;
        t = totalElapsed / TOTAL_REG_SECONDS;
      }
    }

    // fallback: evenly spaced
    if (t == null) {
      t = raw.length > 1 ? index / (raw.length - 1) : 0;
    }

    if (!Number.isFinite(t)) t = 0;
    if (t < 0) t = 0;
    if (t > 1) t = 1;

    out.push({
      t,
      q: periodNum,
      home: Math.max(0, Math.min(100, prob * 100)),
    });
  });

  if (!out.length) return [];

  const lastT = out[out.length - 1]!.t;
  const domainMax = lastT > 0 ? lastT : 1;

  // clamp t to [0, domainMax]
  return out.map((p) => ({
    ...p,
    t: Math.max(0, Math.min(domainMax, p.t)),
  }));
}

// ESPN-style quarter tick positions across 0..1
const QUARTER_TICKS = [0.125, 0.375, 0.625, 0.875];

function formatQuarterTick(x: number): string {
  if (x === 0.125) return "1st";
  if (x === 0.375) return "2nd";
  if (x === 0.625) return "3rd";
  if (x === 0.875) return "4th";
  return "";
}

// ESPN-style vertical labels: 100 at top, 50 middle, 100 bottom
function formatYAxisTick(v: number): string {
  if (v === 100) return "100%";
  if (v === 50) return "50%";
  if (v === 0) return "100%";
  return "";
}

export default function WinProb({
  winProbability,
  homeTeam = "Home",
  awayTeam = "Away",
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

  const lastT = data[data.length - 1]!.t || 1;
  const domainMax = lastT > 0 ? lastT : 1;

  const latest = data[data.length - 1]!;
  const homePctLabel = `${latest.home.toFixed(0)}%`;
  const awayPctLabel = `${(100 - latest.home).toFixed(0)}%`;

  return (
    <div className="card flex flex-col">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold">Win Probability</div>
        <div className="flex items-end gap-6 text-xs uppercase tracking-wide">
          <div className="flex flex-col items-center">
            <span className="opacity-60">{awayTeam}</span>
            <span className="text-base font-semibold">{awayPctLabel}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="opacity-60">{homeTeam}</span>
            <span className="text-base font-semibold">{homePctLabel}</span>
          </div>
        </div>
      </div>

      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
            <XAxis
              dataKey="t"
              type="number"
              domain={[0, domainMax]}
              ticks={QUARTER_TICKS.filter((t) => t <= domainMax)}
              tickFormatter={formatQuarterTick}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 50, 100]}
              tickFormatter={formatYAxisTick}
              tick={{ fontSize: 10 }}
              width={32}
            />
            {/* Center 50% reference line */}
            <ReferenceLine y={50} strokeDasharray="3 3" />
            <Tooltip
              formatter={(value: any) => [`${Number(value).toFixed(1)}%`, "Home WP"]}
              labelFormatter={(_, payload) => {
                const q = payload?.[0]?.payload?.q;
                if (!q) return "Win Probability";
                if (q === 1) return "1st Quarter";
                if (q === 2) return "2nd Quarter";
                if (q === 3) return "3rd Quarter";
                if (q === 4) return "4th Quarter";
                return `Q${q}`;
              }}
            />
            <Line
              type="monotone"
              dataKey="home"
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 text-[10px] text-right opacity-40">
        According to ESPN Analytics
      </div>
    </div>
  );
}
