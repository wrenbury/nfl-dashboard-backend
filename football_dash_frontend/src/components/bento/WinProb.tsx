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

type WinProbPoint = {
  idx: number;
  home: number; // 0–100
  quarter?: string;
  periodNum?: number;
};

function normalizeWinProb(raw: any): WinProbPoint[] {
  if (!Array.isArray(raw)) return [];

  const points: WinProbPoint[] = [];

  for (let i = 0; i < raw.length; i++) {
    const wp = raw[i] || {};

    let rawHome: number | null = null;

    if (typeof wp.homeWinPercentage === "number") {
      rawHome = wp.homeWinPercentage;
    } else if (typeof wp.homeWinProb === "number") {
      rawHome = wp.homeWinProb;
    }

    if (rawHome == null || !isFinite(rawHome)) continue;

    const asPct = rawHome >= 0 && rawHome <= 1 ? rawHome * 100 : rawHome;
    const homePct = Math.max(0, Math.min(100, asPct));

    let quarterLabel: string | undefined;
    let periodNum: number | undefined;

    const p =
      typeof wp.period === "number"
        ? wp.period
        : typeof wp.period?.number === "number"
        ? wp.period.number
        : undefined;

    if (typeof p === "number") {
      periodNum = p;
      if (p >= 1 && p <= 4) {
        const labels = ["", "1st", "2nd", "3rd", "4th"];
        quarterLabel = labels[p] ?? `${p}th`;
      } else if (p > 4) {
        quarterLabel = "OT";
      }
    }

    points.push({
      idx: i,
      home: Math.round(homePct),
      quarter: quarterLabel,
      periodNum,
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

  // --- Quarter tick positions (match ESPN-style spacing) ---

  // Build min/max index per period from actual data
  const segments: Record<number, { min: number; max: number }> = {};
  for (const p of data) {
    if (!p.periodNum || p.periodNum < 1 || p.periodNum > 4) continue;
    const seg = segments[p.periodNum] ?? { min: p.idx, max: p.idx };
    seg.min = Math.min(seg.min, p.idx);
    seg.max = Math.max(seg.max, p.idx);
    segments[p.periodNum] = seg;
  }

  const lastIdx = data[data.length - 1].idx;
  const labelsByPeriod: Record<number, string> = {
    1: "1st",
    2: "2nd",
    3: "3rd",
    4: "4th",
  };

  const quarterTicks: number[] = [];
  const quarterTickLabels: string[] = [];

  const maxPeriodInData = Object.keys(segments)
    .map((k) => Number(k))
    .reduce((m, v) => Math.max(m, v), 0);

  if (maxPeriodInData) {
    // Use real segment midpoints for the periods we actually have
    for (let p = 1; p <= maxPeriodInData; p++) {
      const seg = segments[p];
      if (!seg) continue;
      const mid = (seg.min + seg.max) / 2;
      quarterTicks.push(mid);
      quarterTickLabels.push(labelsByPeriod[p]);
    }
  } else {
    // Fallback: evenly spaced quarters across the data range
    const step = lastIdx / 4;
    for (let p = 1; p <= 4; p++) {
      quarterTicks.push(step * p - step / 2);
      quarterTickLabels.push(labelsByPeriod[p]);
    }
  }

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

      {/* Chart with custom Y labels and ESPN-like quarter spacing */}
      <div className="relative w-full h-40">
        {/* Custom Y-axis labels: 100 / 50 / 100 like ESPN */}
        <div className="absolute inset-y-1 left-0 flex flex-col justify-between text-[10px] opacity-50 pointer-events-none">
          <span>100%</span>
          <span>50%</span>
          <span>100%</span>
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 8, left: 24, bottom: 20 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              strokeOpacity={0.2}
            />
            <XAxis
              dataKey="idx"
              ticks={quarterTicks}
              tickLine={false}
              axisLine={false}
              tickFormatter={(_, index) => quarterTickLabels[index] ?? ""}
            />
            {/* Keep Y domain but hide native ticks; we draw our own labels */}
            <YAxis domain={[0, 100]} tick={false} axisLine={false} />
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
                    {p.quarter && (
                      <div className="mb-1 opacity-70">{p.quarter}</div>
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
