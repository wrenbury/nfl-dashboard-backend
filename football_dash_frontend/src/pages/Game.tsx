// football_dash_frontend/src/pages/Game.tsx

import { useParams, Link } from "react-router-dom";
import useSWR from "swr";
import { API } from "../api";
import BoxScore from "../components/bento/BoxScore";
import TeamStats from "../components/bento/TeamStats";
import PlayByPlay from "../components/bento/PlayByPlay";
import WinProb from "../components/bento/WinProb";

type Sport = "nfl" | "college-football";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();

  let data: any = null;
  if (contentType.includes("application/json")) {
    try {
      data = text ? JSON.parse(text) : null;
    } catch (err) {
      console.error("Game JSON parse error:", err, text);
      throw new Error(
        "Backend returned malformed JSON. Snippet: " + text.slice(0, 200)
      );
    }
  }

  if (!res.ok) {
    const detail =
      (data && (data.detail || data.error || data.message)) || text || "";
    const msg = `HTTP ${res.status}${
      detail ? ` – ${String(detail).slice(0, 200)}` : ""
    }`;
    console.error("Game HTTP error:", msg);
    throw new Error(msg);
  }

  if (!contentType.includes("application/json")) {
    console.error(
      "Game non-JSON response:",
      contentType || "(no content-type)",
      text
    );
    throw new Error(
      "Backend did not return JSON. Snippet: " + text.slice(0, 200)
    );
  }

  return data;
};

export default function Game() {
  const params = useParams<{ sport: Sport; id: string }>();
  const sport = (params.sport ?? "college-football") as Sport;
  const id = params.id ?? "";

  const isNfl = sport === "nfl";

  const { data, error, isLoading } = useSWR(
    isNfl && id ? API.game("nfl", id) : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  if (!isNfl) {
    return (
      <section className="space-y-4">
        <Link
          to="/cfb"
          className="inline-flex text-sm opacity-70 hover:underline"
        >
          ← Back to CFB scoreboard
        </Link>
        <div className="card text-sm opacity-80">
          Detailed game view is currently available for NFL games only.
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="space-y-4">
        <Link
          to="/nfl"
          className="inline-flex text-sm opacity-70 hover:underline"
        >
          ← Back to NFL scoreboard
        </Link>
        <div className="text-sm opacity-80">Loading game…</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-4">
        <Link
          to="/nfl"
          className="inline-flex text-sm opacity-70 hover:underline"
        >
          ← Back to NFL scoreboard
        </Link>
        <div className="card text-sm text-red-400 whitespace-pre-wrap">
          Failed to load game.
          {"\n"}
          {(error as Error).message}
        </div>
      </section>
    );
  }

  if (!data || !data.summary) {
    return (
      <section className="space-y-4">
        <Link
          to="/nfl"
          className="inline-flex text-sm opacity-70 hover:underline"
        >
          ← Back to NFL scoreboard
        </Link>
        <div className="card text-sm opacity-80">
          No data available for this game.
        </div>
      </section>
    );
  }

  const s = data.summary;
  const competitors = Array.isArray(s.competitors) ? s.competitors : [];

  const homeComp = competitors.find((c: any) => c.homeAway === "home");
  const awayComp = competitors.find((c: any) => c.homeAway === "away");
  const homeName = homeComp?.team?.name ?? "Home";
  const awayName = awayComp?.team?.name ?? "Away";

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/nfl"
          className="inline-flex text-sm opacity-70 hover:underline"
        >
          ← Back to NFL scoreboard
        </Link>
        <div className="text-xs opacity-60">
          {s.startTime} • {s.status}
        </div>
      </div>

      <div className="grid md:grid-cols-[2fr,1fr] gap-4">
        <div className="card">
          <div className="flex items-center justify-between gap-4 mb-4">
            {competitors[0] && <Team t={competitors[0]} />}
            <div className="text-3xl font-bold">
              {competitors[0]?.score ?? "-"}
              <span className="opacity-60 text-lg mx-1">–</span>
              {competitors[1]?.score ?? "-"}
            </div>
            {competitors[1] && <Team t={competitors[1]} />}
          </div>
          {s.venue && (
            <div className="text-xs opacity-60">Venue: {s.venue}</div>
          )}
        </div>

        <div className="space-y-4">
          <WinProb
            winProbability={data.winProbability}
            homeTeam={homeName}
            awayTeam={awayName}
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <BoxScore boxscore={data.boxscore} />
          <PlayByPlay plays={data.plays} />
        </div>
        <div>
          <TeamStats teamStats={data.teamStats} />
        </div>
      </div>
    </section>
  );
}

function Team({ t }: { t: any }) {
  return (
    <div className="flex items-center gap-3">
      {t.team?.logo && (
        <img
          src={t.team.logo}
          alt={t.team?.name ?? "Team logo"}
          className="w-10 h-10 rounded-full"
        />
      )}
      <div>
        <div className="font-semibold leading-tight">
          {t.team?.name ?? "Team"}
        </div>
        <div className="text-xs opacity-60">{t.team?.record ?? ""}</div>
      </div>
    </div>
  );
}
