// football_dash_frontend/src/components/ScoreboardHeader.tsx

import { Link, useLocation } from "react-router-dom";

export default function ScoreboardHeader() {
  const { pathname } = useLocation();
  const isCfb = pathname.startsWith("/cfb") || pathname === "/";
  const isNfl = pathname.startsWith("/nfl");

  const base =
    "px-3 py-1 rounded text-sm transition-colors duration-150 border border-transparent";
  const active = "bg-white text-black";
  const inactive = "bg-[#151922] text-slate-200 border-[#262b33]";

  return (
    <header className="border-b border-[#151922] bg-[#050608]/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight">
          Football Dashboard
        </h1>
        <nav className="ml-auto flex gap-3">
          <Link
            to="/cfb"
            className={`${base} ${isCfb ? active : inactive}`}
          >
            CFB
          </Link>
          <Link
            to="/nfl"
            className={`${base} ${isNfl ? active : inactive}`}
          >
            NFL
          </Link>
        </nav>
      </div>
    </header>
  );
}
