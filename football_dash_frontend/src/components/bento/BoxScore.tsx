// football_dash_frontend/src/components/bento/BoxScore.tsx

type BoxScoreCategory = {
  title: string;
  headers?: string[] | null;
  rows: string[][];
};

export default function BoxScore({
  data,
  boxscore,
}: {
  data?: BoxScoreCategory[];
  boxscore?: BoxScoreCategory[];
}) {
  const categories = data ?? boxscore ?? [];
  if (!categories || !categories.length) return null;

  return (
    <div className="card">
      <h3 className="font-semibold mb-4">Box Score</h3>
      <div className="space-y-6">
        {categories.map((category, i) => (
          <div key={i}>
            {/* Category title */}
            <div className="text-sm font-medium text-slate-300 mb-2 pb-1 border-b border-slate-700/50">
              {category.title}
            </div>

            {/* Stats table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                {/* Column headers */}
                {category.headers && category.headers.length > 0 && (
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      {category.headers.map((header, hIdx) => (
                        <th
                          key={hIdx}
                          className={`py-2 text-xs font-medium text-slate-500 uppercase tracking-wide ${
                            hIdx === 0 ? "text-left" : "text-right px-2"
                          }`}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}

                <tbody>
                  {category.rows.map((row, rowIdx) => (
                    <tr
                      key={rowIdx}
                      className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30"
                    >
                      {row.map((cell, cellIdx) => (
                        <td
                          key={cellIdx}
                          className={`py-2 ${
                            cellIdx === 0
                              ? "font-medium text-slate-200"
                              : "text-right text-slate-400 px-2 tabular-nums"
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
          </div>
        ))}
      </div>
    </div>
  );
}
