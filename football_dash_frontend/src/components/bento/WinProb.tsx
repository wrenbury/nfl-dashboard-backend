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
  // For tooltips only
  quarter?: string;
};

function normalizeWinProb(raw: any): WinProbPoint[] {
  if (!Array.isArray(raw)) return [];

  const points: WinProbPoint[] = [];

  for (let i = 0; i < raw.length; i++) {
    const wp = raw[i] || {};

    // ESPN usually provides 0–1
    const rawHome =
      typeof wp.homeWinPercentage === "number"
        ? wp.homeWinPercentage
        : typeof wp.homeWinProb === "number"
        ? wp.homeWinProb
        : null;

    if (rawHome == null) continue;

    const homePct = Math.max(0, Math.min(1, rawHome)) * 100;

    // Quarter/period if present (for tooltip)
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
      <div className="card h-full flex flex-col justify-center">
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

  return (
    <div className="card h-full flex flex-col">
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
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              strokeOpacity={0.2}
            />
            <XAxis
              dataKey="idx"
              hide
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            {/* 50% midline */}
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
              // We intentionally don't set a color here; Recharts will
              // pick a default. If you want to match ESPN exactly we
              // can tweak this later.
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
