// NFL stat header labels mapping
const STAT_HEADER_LABELS: Record<string, string> = {
  // Passing
  completionAttempts: "C/ATT",
  passingYards: "YDS",
  yardsPerPassAttempt: "AVG",
  passingTouchdowns: "TD",
  interceptions: "INT",
  sacks: "SACK",
  adjQBR: "QBR",
  QBRating: "RTG",
  // Rushing
  rushingAttempts: "CAR",
  rushingYards: "YDS",
  yardsPerRushAttempt: "AVG",
  rushingTouchdowns: "TD",
  longRushing: "LNG",
  // Receiving
  receptions: "REC",
  receivingYards: "YDS",
  yardsPerReception: "AVG",
  receivingTouchdowns: "TD",
  longReception: "LNG",
  targets: "TGTS",
  // Fumbles
  fumbles: "FUM",
  fumblesLost: "LOST",
  fumblesRecovered: "REC",
  // Defensive
  totalTackles: "TOT",
  soloTackles: "SOLO",
  tacklesForLoss: "TFL",
  passesDefended: "PD",
  QBHits: "QB HTS",
  defensiveTouchdowns: "TD",
  // Interceptions
  interceptionYards: "YDS",
  interceptionTouchdowns: "TD",
  // Kick Returns
  kickReturns: "NO",
  kickReturnYards: "YDS",
  yardsPerKickReturn: "AVG",
  longKickReturn: "LNG",
  kickReturnTouchdowns: "TD",
  // Punt Returns
  puntReturns: "NO",
  puntReturnYards: "YDS",
  yardsPerPuntReturn: "AVG",
  longPuntReturn: "LNG",
  puntReturnTouchdowns: "TD",
  // Kicking
  fieldGoalsMade: "FG",
  fieldGoalAttempts: "FGA",
  fieldGoalPct: "PCT",
  longFieldGoalMade: "LNG",
  extraPointsMade: "XP",
  extraPointAttempts: "XPA",
  totalKickingPoints: "PTS",
  // Punting
  punts: "NO",
  puntYards: "YDS",
  grossAvgPuntYards: "AVG",
  touchbacks: "TB",
  puntsInside20: "IN 20",
  longPunt: "LNG",
};

function formatHeader(header: string): string {
  return STAT_HEADER_LABELS[header] || header.toUpperCase();
}

type BoxScoreCategory = {
  title: string;
  headers?: string[];
  rows: string[][];
};

export default function BoxScore({ data, boxscore }: { data?: BoxScoreCategory[]; boxscore?: BoxScoreCategory[] }) {
  const categories = data ?? boxscore ?? [];
  if (!categories || !categories.length) return null;

  return (
    <div className="card">
      <h3 className="font-semibold mb-3">Box Score</h3>
      <div className="space-y-4">
        {categories.map((cat, i) => (
          <div key={i} className="overflow-x-auto">
            <div className="text-sm font-medium text-slate-400 mb-2">{cat.title}</div>
            <table className="w-full text-sm">
              {/* Header row */}
              {cat.headers && cat.headers.length > 0 && (
                <thead>
                  <tr className="border-b border-slate-700">
                    {cat.headers.map((header, hi) => (
                      <th
                        key={hi}
                        className={`py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide ${
                          hi === 0 ? "text-left pr-4" : "text-right px-2"
                        }`}
                      >
                        {hi === 0 ? header : formatHeader(header)}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {cat.rows.map((row, ri) => (
                  <tr
                    key={ri}
                    className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30"
                  >
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className={`py-2 ${
                          ci === 0
                            ? "font-medium text-left pr-4 whitespace-nowrap"
                            : "text-right px-2 tabular-nums text-slate-300"
                        }`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
