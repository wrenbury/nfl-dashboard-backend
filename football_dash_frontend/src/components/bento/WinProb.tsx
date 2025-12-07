export default function WinProb({
  data,
  winProbability,
}: {
  data?: any[] | null;
  winProbability?: any[] | null;
}) {
  const series = data ?? winProbability ?? null;
  if (!series || !series.length) return null;
  const last = series[series.length - 1];
  const home = Math.round(
    (last.homeWinPercentage ?? last.homeTeamWinProbability ?? 0) * 100
  );
  return (
    <div className="card">
      <h3 className="font-semibold mb-2">Win Probability</h3>
      <div className="text-sm opacity-80 mb-2">
        Home win chance: <span className="font-semibold">{home}%</span>
      </div>
      <div className="h-2 w-full bg-[#1b2026] rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500"
          style={{ width: `${home}%` }}
        ></div>
      </div>
    </div>
  );
}
