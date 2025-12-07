import { Link, useLocation } from "react-router-dom"

type Team = { team:{ name:string, abbreviation?:string, logo?:string, record?:string }, homeAway:'home'|'away', score?:number }
type Game = { id:string, startTime:string, status:string, competitors: Team[] }

export default function GameCard({ g }: { g: Game }) {
  const loc = useLocation()
  const sport = loc.pathname.includes('nfl') ? 'nfl' : 'college-football'
  const [away, home] = g.competitors[0].homeAway === 'away' ? g.competitors : [g.competitors[1], g.competitors[0]];
  return (
    <Link to={`/${sport}/game/${g.id}`} className="card block">
      <div className="flex gap-4 items-center">
        <TeamRow t={away} />
        <div className="mx-2 text-sm opacity-70">{g.status}</div>
        <TeamRow t={home} />
      </div>
    </Link>
  )
}

function TeamRow({ t }: { t: Team }) {
  return (
    <div className="flex items-center gap-2 w-1/2">
      {t.team.logo && <img src={t.team.logo} className="w-7 h-7 rounded-full" />}
      <div className="flex-1 truncate">
        <div className="truncate">{t.team.name}</div>
        <div className="text-xs opacity-60">{t.team.record || ''}</div>
      </div>
      <div className="text-xl font-bold">{t.score ?? '-'}</div>
    </div>
  )
}
