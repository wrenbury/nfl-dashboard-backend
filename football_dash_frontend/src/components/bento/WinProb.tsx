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

    // Handle both 0–1 and 0–100 inputs
    const asPct =
      rawHome >= 0 && rawHome <= 1 ? rawHome * 100 : rawHome;

    const homePct = Math.max(0, Math.min(100, asPct));

    let quarterLabel: string | undefined;
    const p =
      typeof wp.period === "number"
        ? wp.period
        : typeof wp.period?.number === "number"
        ? wp.period.number
        : undefined;
    if (p && p >= 1 && p <= 4) {
      const labels = ["", "1st", "2nd", "3rd", "4th"];
      quarterLabel = labels[p] ?? `${p}th`;
    } else if (p && p > 4) {
      quarterLabel = "OT";
    }

    points.push({
      idx: i,
      home: Math.round(homePct),
      quarter: quarterLabel,
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

  // Approximate quarter ticks: 1st, 2nd, 3rd, 4th across the series
  const n = data.length;
  const quarterTicks: number[] = [];
  if (n >= 4) {
    quarterTicks.push(
      data[Math.floor(n * 0.125)]?.idx ?? 0, // early 1st
      data[Math.floor(n * 0.375)]?.idx ?? 0, // early 2nd
      data[Math.floor(n * 0.625)]?.idx ?? 0, // early 3rd
      data[Math.floor(n * 0.875)]?.idx ?? data[n - 1].idx // early 4th
    );
  }

  const quarterLabels = ["1st", "2nd", "3rd", "4th"];

  return (
    <div className="card flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold">Win Probability</div>
        <div className="flex items-baseline gap-4 text-xs">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase opacity-60">{homeTeam}</span>
            <span className="text-base font-semibold">{homePctLabel}</span>
          </div>
          <div className="flex flex-col items-end opacity-70">
            <span className="text-[10px] uppercase opacity-60">
              {awayTeam}
            </span>
            <span className="text-sm font-medium">{awayPctLabel}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 20 }}
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
              tickFormatter={(_, index) => quarterLabels[index] ?? ""}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tickLine={false}
              axisLine={false}
              width={32}
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
