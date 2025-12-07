export default function WinProb({ data }:{ data:any[]|null }){
  if (!data || !data.length) return null
  const last = data[data.length-1]
  const home = Math.round((last.homeWinPercentage ?? last.homeTeamWinProbability ?? 0)*100)
  return (
    <div className="card">
      <h3 className="font-semibold mb-2">Win Probability</h3>
      <div className="h-2 w-full bg-[#1b2026] rounded">
        <div className="h-2 bg-white rounded" style={{ width: `${home}%`}} />
      </div>
      <div className="mt-1 text-xs opacity-70">Home: {home}%</div>
    </div>
  )
}
