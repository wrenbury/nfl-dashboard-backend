// football_dash_frontend/src/components/NFLGameCard.tsx

import { Link } from "react-router-dom";

type Team = {
  team: {
    id?: string;
    name: string;
    abbreviation?: string;
    logo?: string;
    record?: string;
    rank?: number;
  };
  homeAway: "home" | "away";
  score?: number;
  winner?: boolean;
};

type Game = {
  id: string;
  sport: string;
  startTime: string;
  status: string;
  competitors: Team[];
};

function formatGameTime(startTime: string): string {
  if (!startTime) return "";
  const date = new Date(startTime);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function NFLGameCard({ game }: { game: Game }) {
  const [away, home] =
    game.competitors[0]?.homeAway === "away"
      ? game.competitors
      : [game.competitors[1], game.competitors[0]];

  const status = game.status?.toLowerCase() || "";
  const isFinal = status.includes("final");
  const isInProgress =
    status.includes("progress") ||
    status.includes("halftime") ||
    /\d+(st|nd|rd|th)/i.test(status);
  const isScheduled = !isFinal && !isInProgress;

  // Determine winner styling
  const awayIsWinner =
    isFinal &&
    away?.score !== undefined &&
    home?.score !== undefined &&
    away.score > home.score;
  const homeIsWinner =
    isFinal &&
    away?.score !== undefined &&
    home?.score !== undefined &&
    home.score > away.score;

  // Determine sport path (cfb or nfl)
  const sportPath = game.sport === "college-football" ? "cfb" : "nfl";

  return (
    <Link
      to={`/${sportPath}/game/${game.id}`}
      className="card block hover:bg-slate-800/50 transition"
    >
      <div className="flex items-center justify-between mb-2">
        {/* Status badge */}
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
            isFinal
              ? "bg-slate-700 text-slate-300"
              : isInProgress
              ? "bg-green-900/50 text-green-400"
              : "bg-slate-800 text-slate-400"
          }`}
        >
          {isFinal ? "FINAL" : isInProgress ? game.status : formatGameTime(game.startTime)}
        </span>
      </div>

      {/* Teams */}
      <div className="space-y-2">
        {/* Away team */}
        <TeamRow
          team={away}
          isWinner={awayIsWinner}
          isLoser={homeIsWinner}
          showScore={!isScheduled}
        />

        {/* Home team */}
        <TeamRow
          team={home}
          isWinner={homeIsWinner}
          isLoser={awayIsWinner}
          showScore={!isScheduled}
        />
      </div>
    </Link>
  );
}

function TeamRow({
  team,
  isWinner,
  isLoser,
  showScore,
}: {
  team?: Team;
  isWinner: boolean;
  isLoser: boolean;
  showScore: boolean;
}) {
  if (!team) {
    return (
      <div className="flex items-center justify-between py-1 opacity-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-slate-800" />
          <span>TBD</span>
        </div>
        <span className="text-lg font-bold">-</span>
      </div>
    );
  }

  const { team: teamData, score } = team;

  return (
    <div
      className={`flex items-center justify-between py-1 ${
        isLoser ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {teamData.logo ? (
          <img
            src={teamData.logo}
            alt={teamData.name}
            className="w-8 h-8 rounded-full object-contain bg-slate-800/50 flex-shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-slate-800 flex-shrink-0" />
        )}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            {teamData.rank && (
              <span className="text-xs font-bold text-amber-400 px-1.5 py-0.5 bg-amber-400/10 rounded">
                #{teamData.rank}
              </span>
            )}
            <span
              className={`font-semibold truncate ${
                isWinner ? "text-white" : ""
              }`}
            >
              {teamData.name}
            </span>
          </div>
          {teamData.record && (
            <span className="text-xs text-slate-500">{teamData.record}</span>
          )}
        </div>
      </div>

      {showScore && (
        <div className="flex items-center gap-2">
          {isWinner && (
            <span className="text-green-500 text-xs font-bold">
              <svg
                className="w-3 h-3"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          )}
          <span
            className={`text-xl font-bold tabular-nums ${
              isWinner ? "text-white" : ""
            }`}
          >
            {score ?? "-"}
          </span>
        </div>
      )}
    </div>
  );
}
