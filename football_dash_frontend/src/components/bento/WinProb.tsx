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

type WinProbPoint = {
  t: number;        // 0.0 – 1.0, fraction of game elapsed (regulation)
  home: number;     // 0–100%
  periodNum?: number;
};

const TOTAL_REG_SECONDS = 60 * 60; // 60 minutes, ignore OT for now

function normalizeWinProb(raw: any): WinProbPoint[] {
  if (!Array.isArray(raw)) return [];

  const points: WinProbPoint[] = [];

  for (let i = 0; i < raw.length; i++) {
    const wp = raw[i] || {};

    // --- win % ---
    let rawHome: number | null = null;
    if (typeof wp.homeWinPercentage === "number") {
      rawHome = wp.homeWinPercentage;
    } else if (typeof wp.homeWinProb === "number") {
      rawHome = wp.homeWinProb;
    }
    if (rawHome == null || !isFinite(rawHome)) continue;

    const asPct =
      rawHome >= 0 && rawHome <= 1 ? rawHome * 100 : rawHome;
    const homePct = Math.max(0, Math.min(100, asPct));

    // --- period / quarter ---
    let periodNum: number | undefined;
    const p =
      typeof wp.period === "number"
        ? wp.period
        : typeof wp.period?.number === "number"
        ? wp.period.number
        : undefined;
    if (typeof p === "number") {
      periodNum = p;
    }

    // --- time: convert seconds remaining to fraction elapsed ---
    let secondsLeft: number | null = null;
    if (typeof wp.secondsLeft === "number") {
      secondsLeft = wp.secondsLeft;
    } else if (typeof wp.secondsRemaining === "number") {
      secondsLeft = wp.secondsRemaining;
    }

    let t: number;
    if (secondsLeft != null && isFinite(secondsLeft)) {
      const clamped = Math.max(0, Math.min(TOTAL_REG_SECONDS, secondsLeft));
      t = 1 - clamped / TOTAL_REG_SECONDS; // 0 at start, 1 at end
    } else {
      // Fallback: evenly spaced by index if we don't have timing info
      t = i; // We'll renormalize below
    }

    points.push({
      t,
      home: Math.round(homePct),
      periodNum,
    });
  }

  if (!points.length) return points;

  // If we had to use index-based t, normalize them into 0–1 range.
  const tMax = points.reduce((m, p) => Math.max(m, p.t), 0);
  if (tMax > 1) {
    points.forEach((p) => {
      p.t = p.t / tMax;
    });
  }

  return points;
}

function formatPercent(v: number | string | undefined): string {
  if (v == null) return "";
  const n = typeof v === "number" ? v : parseFloat(v);
  if (!isFinite(n)) return "";
  return `${Math.round(n)}%`;
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

  const latest = data[data.length - 1];
  const homePctLabel = formatPercent(latest.home);
  const awayPctLabel = formatPercent(100 - latest.home);

  // Fixed “ESPN-style” quarter ticks at midpoints of each quarter.
  // 4 quarters => 60 minutes => quarters at 0–15–30–45–60 min.
  // Midpoints (as fraction of game): 7.5, 22.5, 37.5, 52.5 minutes.
  const quarterTicks = [0.125, 0.375, 0.625, 0.875];
  const quarterLabels = ["1st", "2nd", "3rd", "4th"];

  return (
    <div className="card flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold">Win Probability</div>
        <div className="flex items-baseline gap-6 text-xs">
          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase opacity-60">
              {homeTeam}
            </span>
            <span className="text-base font-semibold">{homePctLabel}</span>
          </div>
          <div className="flex flex-col items-center opacity-80">
            <span className="text-[10px] uppercase opacity-60">
              {awayTeam}
            </span>
            <span className="text-base font-semibold">{awayPctLabel}</span>
          </div>
        </div>
      </div>

      <div className="w-full h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 8, left: 8, bottom: 20 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              strokeOpacity={0.2}
            />
            <XAxis
              dataKey="t"
              type="number"
              domain={[0, 1]}
              ticks={quarterTicks}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => {
                const i = quarterTicks.findIndex(
                  (tick) => Math.abs(tick - value) < 0.001
                );
                return quarterLabels[i] ?? "";
              }}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(v) => `${v}%`}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <ReferenceLine
              y={50}
              stroke="#ffffff"
              strokeOpacity={0.2}
              strokeDasharray="3 3"
            />
            <Tooltip
              cursor={{ strokeOpacity: 0.1 }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const p = payload[0].payload as WinProbPoint;
                return (
                  <div className="rounded-md bg-[#050608] border border-[#262b33] px-3 py-2 text-xs">
                    {p.periodNum && (
                      <div className="mb-1 opacity-70">
                        {["", "1st", "2nd", "3rd", "4th"][p.periodNum] ??
                          `Q${p.periodNum}`}
                      </div>
                    )}
                    <div className="flex flex-col gap-0.5">
                      <div>
                        <span className="opacity-60 mr-1">{homeTeam}</span>
                        <span className="font-medium">
                          {formatPercent(p.home)}
                        </span>
                      </div>
                      <div className="opacity-80">
                        <span className="opacity-60 mr-1">{awayTeam}</span>
                        <span>{formatPercent(100 - p.home)}</span>
                      </div>
                    </div>
                  </div>
                );
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
