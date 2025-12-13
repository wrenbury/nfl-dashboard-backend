// football_dash_frontend/src/components/bento/CfbAnalytics.tsx

type Props = {
  analytics?: {
    advanced?: any;
    drives?: any[];
  } | null;
  homeTeam?: string;
  awayTeam?: string;
};

export default function CfbAnalytics({ analytics, homeTeam = "Home", awayTeam = "Away" }: Props) {
  if (!analytics || (!analytics.advanced && !analytics.drives)) {
    return null;
  }

  const advanced = analytics.advanced;
  const drives = analytics.drives;

  // Parse advanced stats
  let homeAdvanced: any = null;
  let awayAdvanced: any = null;

  if (advanced) {
    // Advanced stats come as an object with teams property
    const teams = advanced.teams || [];
    homeAdvanced = teams.find((t: any) => t.team === homeTeam);
    awayAdvanced = teams.find((t: any) => t.team === awayTeam);
  }

  return (
    <div className="space-y-4">
      {/* Advanced EPA Metrics */}
      {(homeAdvanced || awayAdvanced) && (
        <div className="card">
          <h3 className="font-semibold mb-3">Advanced Analytics (EPA)</h3>
          <div className="text-xs opacity-70 mb-3">
            Expected Points Added measures the value of each play in terms of points
          </div>

          <div className="space-y-3">
            {/* Overall EPA */}
            <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-400">
                  {awayAdvanced?.offense?.overallEPA?.toFixed(2) || "N/A"}
                </div>
                <div className="text-xs opacity-60 mt-1">{awayTeam}</div>
              </div>
              <div className="text-center text-sm opacity-60">
                Offensive EPA
              </div>
              <div className="text-left">
                <div className="text-2xl font-bold text-red-400">
                  {homeAdvanced?.offense?.overallEPA?.toFixed(2) || "N/A"}
                </div>
                <div className="text-xs opacity-60 mt-1">{homeTeam}</div>
              </div>
            </div>

            {/* Passing EPA */}
            <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
              <div className="text-right">
                <div className="text-lg font-semibold">
                  {awayAdvanced?.offense?.passingEPA?.toFixed(2) || "N/A"}
                </div>
              </div>
              <div className="text-center text-xs opacity-60">
                Passing EPA
              </div>
              <div className="text-left">
                <div className="text-lg font-semibold">
                  {homeAdvanced?.offense?.passingEPA?.toFixed(2) || "N/A"}
                </div>
              </div>
            </div>

            {/* Rushing EPA */}
            <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
              <div className="text-right">
                <div className="text-lg font-semibold">
                  {awayAdvanced?.offense?.rushingEPA?.toFixed(2) || "N/A"}
                </div>
              </div>
              <div className="text-center text-xs opacity-60">
                Rushing EPA
              </div>
              <div className="text-left">
                <div className="text-lg font-semibold">
                  {homeAdvanced?.offense?.rushingEPA?.toFixed(2) || "N/A"}
                </div>
              </div>
            </div>

            {/* Success Rate */}
            <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center pt-2 border-t border-slate-700">
              <div className="text-right">
                <div className="text-lg font-semibold text-green-400">
                  {awayAdvanced?.offense?.successRate
                    ? `${(awayAdvanced.offense.successRate * 100).toFixed(1)}%`
                    : "N/A"}
                </div>
              </div>
              <div className="text-center text-xs opacity-60">
                Success Rate
              </div>
              <div className="text-left">
                <div className="text-lg font-semibold text-green-400">
                  {homeAdvanced?.offense?.successRate
                    ? `${(homeAdvanced.offense.successRate * 100).toFixed(1)}%`
                    : "N/A"}
                </div>
              </div>
            </div>

            {/* Explosiveness */}
            <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
              <div className="text-right">
                <div className="text-lg font-semibold text-yellow-400">
                  {awayAdvanced?.offense?.explosiveness?.toFixed(2) || "N/A"}
                </div>
              </div>
              <div className="text-center text-xs opacity-60">
                Explosiveness
              </div>
              <div className="text-left">
                <div className="text-lg font-semibold text-yellow-400">
                  {homeAdvanced?.offense?.explosiveness?.toFixed(2) || "N/A"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drives Summary */}
      {drives && drives.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-3">Scoring Drives</h3>

          <div className="space-y-2">
            {drives
              .filter((d: any) => {
                const result = (d.result || "").toLowerCase();
                return result.includes("touchdown") || result.includes("field goal") || result.includes("td") || result.includes("fg");
              })
              .map((drive: any, idx: number) => {
                const isHome = drive.team === homeTeam || drive.offense === homeTeam;
                const team = isHome ? homeTeam : awayTeam;
                const result = drive.result || "";
                const plays = drive.plays || 0;
                const yards = drive.yards || 0;
                const isTD = result.toLowerCase().includes("touchdown") || result.toLowerCase().includes("td");

                return (
                  <div
                    key={idx}
                    className={`p-3 rounded ${
                      isTD ? "bg-green-900/20 border-l-2 border-green-500" : "bg-yellow-900/20 border-l-2 border-yellow-500"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-sm">{team}</div>
                        <div className="text-xs opacity-70">
                          Q{drive.quarter || "?"} • {plays} plays • {yards} yards
                        </div>
                      </div>
                      <div className={`text-sm font-bold ${isTD ? "text-green-400" : "text-yellow-400"}`}>
                        {isTD ? "TD" : "FG"}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {drives.filter((d: any) => {
            const result = (d.result || "").toLowerCase();
            return result.includes("touchdown") || result.includes("field goal") || result.includes("td") || result.includes("fg");
          }).length === 0 && (
            <div className="text-sm opacity-60 text-center py-4">
              No scoring drives data available
            </div>
          )}
        </div>
      )}
    </div>
  );
}
