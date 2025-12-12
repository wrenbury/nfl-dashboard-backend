// football_dash_frontend/src/components/FieldDisplay.tsx

import { GameSituation } from "../types";

type Props = {
  situation: GameSituation | null;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamColor?: string;
  awayTeamColor?: string;
  homeTeamAbbr?: string;
  awayTeamAbbr?: string;
};

export default function FieldDisplay({
  situation,
  homeTeamId,
  awayTeamId,
  homeTeamColor = "#1a472a",
  awayTeamColor = "#1a472a",
  homeTeamAbbr = "HOME",
  awayTeamAbbr = "AWAY",
}: Props) {
  // Use situation data if available, otherwise use defaults
  const yardLine = situation?.yardLine || 50;
  const possessionTeamId = situation?.possessionTeamId || null;
  const down = situation?.down || null;
  const distance = situation?.distance || null;
  const isRedZone = situation?.isRedZone || false;

  // Determine which end zone is which
  // In NFL, yard lines go 0-100, with 50 being midfield
  // 0-20 is away team's red zone, 80-100 is home team's red zone
  const yardPosition = yardLine || 50;

  // Calculate ball position as percentage (0-100)
  const ballPositionPercent = (yardPosition / 100) * 100;

  // Field dimensions for SVG
  const fieldWidth = 800;
  const fieldHeight = 400;
  const endZoneWidth = 60;
  const playingFieldWidth = fieldWidth - (endZoneWidth * 2);

  // Convert yard position to SVG X coordinate
  const ballX = endZoneWidth + (yardPosition / 100) * playingFieldWidth;
  const ballY = fieldHeight / 2;

  // Always show ball during live games (even if no possession data)
  const showBall = true;

  return (
    <div className="w-full">
      {/* Field container with 3D perspective */}
      <div className="relative w-full bg-gradient-to-b from-slate-800 to-slate-900 rounded-lg overflow-hidden shadow-2xl">
        <svg
          viewBox={`0 0 ${fieldWidth} ${fieldHeight}`}
          className="w-full h-auto"
          style={{
            filter: "drop-shadow(0 10px 20px rgba(0, 0, 0, 0.3))",
          }}
        >
          {/* Field background - green with slight gradient */}
          <defs>
            <linearGradient id="fieldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2d5016" />
              <stop offset="50%" stopColor="#1a472a" />
              <stop offset="100%" stopColor="#2d5016" />
            </linearGradient>

            {/* Pattern for field stripes */}
            <pattern id="stripes" x="0" y="0" width="40" height={fieldHeight} patternUnits="userSpaceOnUse">
              <rect x="0" y="0" width="20" height={fieldHeight} fill="#1a472a" />
              <rect x="20" y="0" width="20" height={fieldHeight} fill="#1e5230" />
            </pattern>

            {/* Red zone highlight */}
            <linearGradient id="redZoneGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(220, 38, 38, 0.15)" />
              <stop offset="50%" stopColor="rgba(220, 38, 38, 0.25)" />
              <stop offset="100%" stopColor="rgba(220, 38, 38, 0.15)" />
            </linearGradient>
          </defs>

          {/* Away end zone (left) */}
          <rect
            x="0"
            y="0"
            width={endZoneWidth}
            height={fieldHeight}
            fill={awayTeamColor}
            opacity="0.9"
          />
          <text
            x={endZoneWidth / 2}
            y={fieldHeight / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize="24"
            fontWeight="bold"
            opacity="0.8"
            transform={`rotate(-90 ${endZoneWidth / 2} ${fieldHeight / 2})`}
          >
            {awayTeamAbbr}
          </text>

          {/* Home end zone (right) */}
          <rect
            x={fieldWidth - endZoneWidth}
            y="0"
            width={endZoneWidth}
            height={fieldHeight}
            fill={homeTeamColor}
            opacity="0.9"
          />
          <text
            x={fieldWidth - endZoneWidth / 2}
            y={fieldHeight / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize="24"
            fontWeight="bold"
            opacity="0.8"
            transform={`rotate(-90 ${fieldWidth - endZoneWidth / 2} ${fieldHeight / 2})`}
          >
            {homeTeamAbbr}
          </text>

          {/* Playing field with stripes */}
          <rect
            x={endZoneWidth}
            y="0"
            width={playingFieldWidth}
            height={fieldHeight}
            fill="url(#stripes)"
          />

          {/* Red zones highlight */}
          {isRedZone && (
            <>
              {/* Away red zone (0-20 yards) */}
              <rect
                x={endZoneWidth}
                y="0"
                width={playingFieldWidth * 0.2}
                height={fieldHeight}
                fill="url(#redZoneGradient)"
              />
              {/* Home red zone (80-100 yards) */}
              <rect
                x={endZoneWidth + playingFieldWidth * 0.8}
                y="0"
                width={playingFieldWidth * 0.2}
                height={fieldHeight}
                fill="url(#redZoneGradient)"
              />
            </>
          )}

          {/* Yard lines */}
          {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((yard) => {
            const x = endZoneWidth + (yard / 100) * playingFieldWidth;
            const isMidfield = yard === 50;

            return (
              <g key={yard}>
                {/* Yard line */}
                <line
                  x1={x}
                  y1="0"
                  x2={x}
                  y2={fieldHeight}
                  stroke="white"
                  strokeWidth={isMidfield ? "3" : "2"}
                  opacity={isMidfield ? "0.9" : "0.6"}
                />

                {/* Yard number (top) */}
                <text
                  x={x}
                  y="30"
                  textAnchor="middle"
                  fill="white"
                  fontSize="20"
                  fontWeight="bold"
                  opacity="0.7"
                >
                  {yard <= 50 ? yard : 100 - yard}
                </text>

                {/* Yard number (bottom) */}
                <text
                  x={x}
                  y={fieldHeight - 30}
                  textAnchor="middle"
                  fill="white"
                  fontSize="20"
                  fontWeight="bold"
                  opacity="0.7"
                  transform={`rotate(180 ${x} ${fieldHeight - 30})`}
                >
                  {yard <= 50 ? yard : 100 - yard}
                </text>
              </g>
            );
          })}

          {/* Hash marks (every 5 yards) */}
          {Array.from({ length: 19 }, (_, i) => (i + 1) * 5).map((yard) => {
            if (yard % 10 === 0) return null; // Skip decade lines
            const x = endZoneWidth + (yard / 100) * playingFieldWidth;

            return (
              <g key={`hash-${yard}`}>
                <line
                  x1={x}
                  y1={fieldHeight * 0.35}
                  x2={x}
                  y2={fieldHeight * 0.38}
                  stroke="white"
                  strokeWidth="2"
                  opacity="0.5"
                />
                <line
                  x1={x}
                  y1={fieldHeight * 0.62}
                  x2={x}
                  y2={fieldHeight * 0.65}
                  stroke="white"
                  strokeWidth="2"
                  opacity="0.5"
                />
              </g>
            );
          })}

          {/* Ball marker */}
          {showBall && (
            <g>
              {/* Ball position line */}
              <line
                x1={ballX}
                y1="0"
                x2={ballX}
                y2={fieldHeight}
                stroke="#fbbf24"
                strokeWidth="4"
                strokeDasharray="10,5"
                opacity="0.8"
              />

              {/* Ball icon */}
              <g transform={`translate(${ballX}, ${ballY})`}>
                {/* Glow effect */}
                <circle
                  cx="0"
                  cy="0"
                  r="25"
                  fill="#fbbf24"
                  opacity="0.3"
                />
                {/* Ball */}
                <ellipse
                  cx="0"
                  cy="0"
                  rx="18"
                  ry="12"
                  fill="#8B4513"
                  stroke="#5d2f0f"
                  strokeWidth="2"
                />
                {/* Laces */}
                <line x1="-8" y1="0" x2="8" y2="0" stroke="white" strokeWidth="1.5" />
                <line x1="-6" y1="-3" x2="-6" y2="3" stroke="white" strokeWidth="1" />
                <line x1="-2" y1="-3" x2="-2" y2="3" stroke="white" strokeWidth="1" />
                <line x1="2" y1="-3" x2="2" y2="3" stroke="white" strokeWidth="1" />
                <line x1="6" y1="-3" x2="6" y2="3" stroke="white" strokeWidth="1" />
              </g>

              {/* Yard line indicator */}
              <rect
                x={ballX - 30}
                y={ballY - 50}
                width="60"
                height="30"
                rx="5"
                fill="rgba(0, 0, 0, 0.8)"
              />
              <text
                x={ballX}
                y={ballY - 30}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#fbbf24"
                fontSize="16"
                fontWeight="bold"
              >
                {yardLine}
              </text>
            </g>
          )}
        </svg>

        {/* Down and distance overlay */}
        {down && distance !== undefined && (
          <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-sm px-4 py-2 rounded-lg border border-slate-600">
            <div className="text-amber-400 text-sm font-bold">
              {down === 1 ? "1ST" : down === 2 ? "2ND" : down === 3 ? "3RD" : "4TH"}
              {" & "}
              {distance}
            </div>
          </div>
        )}

        {/* Red zone indicator */}
        {isRedZone && (
          <div className="absolute top-4 right-4 bg-red-600/90 backdrop-blur-sm px-3 py-1.5 rounded-lg">
            <div className="text-white text-xs font-bold tracking-wide">
              RED ZONE
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
