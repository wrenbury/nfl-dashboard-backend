import { useParams, Link } from "react-router-dom"
import useSWR from "swr"
import { API } from "../lib/api"
import BoxScore from "../components/Bento/BoxScore"
import TeamStats from "../components/Bento/TeamStats"
import PlayByPlay from "../components/Bento/PlayByPlay"
import WinProb from "../components/Bento/WinProb"

const fetcher = (u:string)=>fetch(u).then(r=>r.json())

export default function Game(){
  const { sport = 'college-football', id = '' } = useParams()
  const { data } = useSWR(API.game(sport as any, id), fetcher)

  if (!data) return <div className="p-6">Loading…</div>
  const s = data.summary
  const [away, home] = s.competitors[0].homeAway === 'away' ? s.competitors : [s.competitors[1], s.competitors[0]]

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
      <div className="lg:col-span-2 card">
        <header className="flex items-center justify-between">
          <Link to={`/${sport}`} className="text-sm opacity-60">← Back</Link>
          <div className="text-lg">{s.venue}</div>
        </header>
        <div className="mt-3 flex items-center justify-between">
          <Team t={away} />
          <div className="text-4xl font-black">{away.score ?? '-'} — {home.score ?? '-'}</div>
          <Team t={home} />
        </div>
        <div className="mt-1 text-sm opacity-70">{s.status}</div>
      </div>

      <div className="grid gap-4">
        <BoxScore data={data.boxscore}/>
        <TeamStats data={data.teamStats}/>
        <WinProb data={data.winProbability}/>
        <PlayByPlay data={data.plays}/>
      </div>
    </div>
  )
}

function Team({ t }:any){
  return (
    <div className="flex items-center gap-3">
      {t.team.logo && <img src={t.team.logo} className="w-10 h-10 rounded-full" />}
      <div>
        <div className="font-semibold">{t.team.name}</div>
        <div className="text-xs opacity-60">{t.team.record || ''}</div>
      </div>
    </div>
  )
}
