import { Link, useLocation } from "react-router-dom";

export default function ScoreboardHeader() {
  const { pathname } = useLocation();
  const isCfb = pathname.startsWith("/cfb") || pathname === "/";
  const isNfl = pathname.startsWith("/nfl");

  const baseClasses =
    "px-3 py-1 rounded text-sm transition-colors duration-150";
  const activeClasses = "bg-white text-black";
  const inactiveClasses = "bg-[#1b2026] text-slate-200";

  return (
    <div className="border-b border-[#1b2026]">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
        <h1 className="text-2xl font-bold">Football Dashboard</h1>
        <nav className="ml-auto flex gap-3">
          <Link
            to="/cfb"
            className={`${baseClasses} ${
              isCfb ? activeClasses : inactiveClasses
            }`}
          >
            CFB
          </Link>
          <Link
            to="/nfl"
            className={`${baseClasses} ${
              isNfl ? activeClasses : inactiveClasses
            }`}
          >
            NFL
          </Link>
        </nav>
      </div>
    </div>
  );
}
