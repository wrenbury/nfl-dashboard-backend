// football_dash_frontend/src/components/DriveInfo.tsx

import { GameSituation } from "../types";

type Props = {
  situation: GameSituation;
  plays?: any[];
};

export default function DriveInfo({ situation, plays }: Props) {
  const { possessionText, downDistanceText, clock, period } = situation;

  // Get the last play from plays array
  const lastPlay = plays && plays.length > 0 ? plays[plays.length - 1] : null;

  // Helper to format the period
  const formatPeriod = (p?: number | null) => {
    if (!p) return "";
    if (p === 1) return "1st Quarter";
    if (p === 2) return "2nd Quarter";
    if (p === 3) return "3rd Quarter";
    if (p === 4) return "4th Quarter";
    if (p > 4) return `OT${p > 5 ? ` ${p - 4}` : ""}`;
    return "";
  };

  return (
    <div className="space-y-4">
      {/* Game clock */}
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-slate-400 text-xs uppercase tracking-wide mb-1">
              Time
            </div>
            <div className="text-2xl font-bold text-white">
              {clock || "--:--"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-slate-400 text-xs uppercase tracking-wide mb-1">
              Quarter
            </div>
            <div className="text-2xl font-bold text-white">
              {period ? (period > 4 ? "OT" : period) : "-"}
            </div>
          </div>
        </div>
      </div>

      {/* Current possession */}
      {(possessionText || downDistanceText) && (
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <div className="text-slate-400 text-xs uppercase tracking-wide mb-2">
            Ball On
          </div>
          <div className="text-white font-semibold">
            {downDistanceText || possessionText || "—"}
          </div>
        </div>
      )}

      {/* Last play */}
      {lastPlay && (
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <div className="flex items-start justify-between mb-2">
            <div className="text-slate-400 text-xs uppercase tracking-wide">
              Last Play
            </div>
            {lastPlay.clock && (
              <div className="text-slate-500 text-xs">
                {lastPlay.clock.displayValue || lastPlay.clock}
              </div>
            )}
          </div>
          <div className="text-white text-sm leading-relaxed">
            {lastPlay.text || lastPlay.description || "No play description available"}
          </div>

          {/* Play result (if available) */}
          {lastPlay.statYardage !== undefined && (
            <div className="mt-2 pt-2 border-t border-slate-700">
              <div className="flex items-center gap-4 text-xs">
                {lastPlay.statYardage !== 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400">Yards:</span>
                    <span className={`font-semibold ${
                      lastPlay.statYardage > 0 ? "text-green-400" : "text-red-400"
                    }`}>
                      {lastPlay.statYardage > 0 ? "+" : ""}{lastPlay.statYardage}
                    </span>
                  </div>
                )}
                {lastPlay.type && lastPlay.type.text && (
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400">Type:</span>
                    <span className="text-white font-medium">{lastPlay.type.text}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Drive info (if we have plays data) */}
      {plays && plays.length > 0 && (
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <div className="text-slate-400 text-xs uppercase tracking-wide mb-3">
            Current Drive
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-slate-400 text-xs mb-1">Plays</div>
              <div className="text-white font-bold text-lg">{plays.length}</div>
            </div>
            <div>
              <div className="text-slate-400 text-xs mb-1">Yards</div>
              <div className="text-white font-bold text-lg">
                {plays.reduce((total, play) => {
                  const yards = play.statYardage || 0;
                  return total + (typeof yards === "number" ? yards : 0);
                }, 0)}
              </div>
            </div>
            <div>
              <div className="text-slate-400 text-xs mb-1">Time</div>
              <div className="text-white font-bold text-lg">
                {/* Calculate drive time if available */}
                {plays[0]?.clock && lastPlay?.clock ? "—" : "—"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
