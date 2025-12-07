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
  const { data } = useSWR(API.game(sport as any, id), fetcher);

  if (!data) return <div className="p-6">Loading…</div>;

  const s = data.summary;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Link to={`/${sport}`} className="text-sm opacity-70 hover:underline">
          ← Back to scoreboard
        </Link>
        <div className="text-xs opacity-60">
          {s.startTime} • {s.status.type.detail}
        </div>
      </div>

      <div className="grid md:grid-cols-[2fr_1fr] gap-4">
        {/* Score header / teams */}
        <div className="card">
          <div className="flex items-center justify-between gap-4 mb-4">
            <Team t={s.competitors[0]} />
            <div className="text-3xl font-bold">
              {s.competitors[0].score} - {s.competitors[1].score}
            </div>
            <Team t={s.competitors[1]} />
          </div>
          <div className="text-xs opacity-60 flex justify-between">
            <span>{s.venue.fullName}</span>
            <span>{s.status.type.description}</span>
          </div>
        </div>

        {/* Win probability card */}
        <WinProb winProbability={data.winProbability} />
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
