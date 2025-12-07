// football_dash_frontend/src/pages/Game.tsx

import { useParams, Link } from "react-router-dom";
import useSWR from "swr";
import { API } from "../api";
import BoxScore from "../components/bento/BoxScore";
import TeamStats from "../components/bento/TeamStats";
import PlayByPlay from "../components/bento/PlayByPlay";
import WinProb from "../components/bento/WinProb";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function Game() {
  const { sport = "college-football", id = "" } = useParams();

  const isNfl = sport === "nfl";

  // IMPORTANT:
  // - We ONLY use ESPN (via /api/game/nfl/{id}) for NFL.
  // - For college-football we do NOT call ESPN at all; detailed CFB
  //   game view will be implemented later using CollegeFootballData.
  const { data } = useSWR(
    isNfl && id ? API.game("nfl", id) : null,
    fetcher
  );

  if (!isNfl) {
    return (
      <div className="p-6 space-y-4">
        <Link to="/cfb" className="text-sm opacity-70 hover:underline">
          ← Back to CFB scoreboard
        </Link>
        <div className="text-sm opacity-80">
          Detailed game view is currently available for NFL games only.
        </div>
      </div>
    );
  }

  if (!data) return <div className="p-6">Loading…</div>;

  const s = data.summary;
  const competitors = Array.isArray(s.competitors) ? s.competitors : [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Link to={`/${sport}`} className="text-sm opacity-70 hover:underline">
          ← Back to scoreboard
        </Link>
        <div className="text-xs opacity-60">
          {s.startTime} • {s.status}
        </div>
      </div>

      <div className="grid md:grid-cols-[2fr_1fr] gap-4">
        {/* Score header / teams */}
        <div className="card">
          <div className="flex items-center justify-between gap-4 mb-4">
            {competitors[0] && <Team t={competitors[0]} />}
            <div className="text-3xl font-bold">
              {competitors[0]?.score ?? "-"} - {competitors[1]?.score ?? "-"}
            </div>
            {competitors[1] && <Team t={competitors[1]} />}
          </div>
          {s.venue && (
            <div className="text-xs opacity-60">Venue: {s.venue}</div>
          )}
        </div>

        {/* Simple meta / win prob */}
        <div className="space-y-4">
          <WinProb winProbability={data.winProbability} />
        </div>
      </div>

      {/* Bento grid */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <BoxScore boxscore={data.boxscore} />
          <PlayByPlay plays={data.plays} />
        </div>
        <div>
          <TeamStats teamStats={data.teamStats} />
        </div>
      </div>
    </div>
  );
}

function Team({ t }: any) {
  return (
    <div className="flex items-center gap-3">
      {t.team.logo && (
        <img src={t.team.logo} className="w-10 h-10 rounded-full" />
      )}
      <div>
        <div className="font-semibold">{t.team.name}</div>
        <div className="text-xs opacity-60">{t.team.record || ""}</div>
      </div>
    </div>
  );
}
