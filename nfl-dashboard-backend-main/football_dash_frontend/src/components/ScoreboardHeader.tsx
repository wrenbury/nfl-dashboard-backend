import { Link, useLocation } from "react-router-dom";

export default function ScoreboardHeader(){
  const { pathname } = useLocation();
  return (
    <div className="border-b border-[#1b2026]">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
        <h1 className="text-2xl font-bold">College Football Scoreboard</h1>
        <nav className="ml-auto flex gap-3">
          <Link className={`px-3 py-1 rounded ${pathname.startsWith('/cfb')?'bg-white text-black':'bg-[#1b2026]'}`} to="/cfb">CFB</Link>
          <Link className={`px-3 py-1 rounded ${pathname.startsWith('/nfl')?'bg-white text-black':'bg-[#1b2026]'}`} to="/nfl">NFL</Link>
        </nav>
      </div>
    </div>
  )
}
