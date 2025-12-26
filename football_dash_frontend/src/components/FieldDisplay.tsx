// football_dash_frontend/src/components/FieldDisplay.tsx

import { GameSituation } from "../types";
import "./FieldDisplay.css";

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
  homeTeamColor = "#a71930",
  awayTeamColor = "#a71930",
  homeTeamAbbr = "HOME",
  awayTeamAbbr = "AWAY",
}: Props) {
  // Debug logging to help troubleshoot yardLine issue
  console.log("FieldDisplay - situation data:", situation);
  console.log("FieldDisplay - yardLine value:", situation?.yardLine);

  // ESPN's yardLine is relative to the team whose territory it's in
  // If ball is at "SF 40" (home team territory), yardLine=40 means 40 yards from SF's goal
  // We need to convert to absolute position (0-100 from away team's goal)
  const rawYardLine = situation?.yardLine !== undefined && situation?.yardLine !== null
    ? situation.yardLine
    : 50;

  // Determine if ball is in home team territory by checking possessionText or downDistanceText
  // possessionText format: "SF 40" (SF has ball at SF 40 yard line)
  // downDistanceText format: "1st & 10 at SF 40" (ball is at SF 40 yard line)
  const textToCheck = situation?.possessionText || situation?.downDistanceText || "";
  const isInHomeTerritory = textToCheck.includes(` ${homeTeamAbbr} `) ||
                           textToCheck.includes(` at ${homeTeamAbbr} `) ||
                           textToCheck.startsWith(`${homeTeamAbbr} `);

  // Convert to absolute yardLine (0-100 from away goal line)
  // If in home territory, we need to invert: 100 - yardLine
  const yardLine = isInHomeTerritory ? (100 - rawYardLine) : rawYardLine;

  // Infer possession team from possessionText when ESPN doesn't provide possessionTeamId
  // possessionText format: "SF 40" or "SF ball on LAC 44" - first team abbreviation has possession
  // NOTE: downDistanceText "3rd & 10 at DET 26" indicates territory, not possession!
  let inferredPossessionTeamId = situation?.possessionTeamId || null;
  if (!inferredPossessionTeamId && situation?.possessionText) {
    // Extract first team abbreviation from possessionText (the team with the ball)
    const teamMatch = situation.possessionText.match(/^([A-Z]{2,3})\s/);
    if (teamMatch && teamMatch[1]) {
      const teamAbbr = teamMatch[1];
      // Match abbreviation to home or away team
      if (teamAbbr === homeTeamAbbr) {
        inferredPossessionTeamId = homeTeamId;
      } else if (teamAbbr === awayTeamAbbr) {
        inferredPossessionTeamId = awayTeamId;
      }
    }
  }

  const isRedZone = situation?.isRedZone || false;

  console.log("FieldDisplay - Team IDs - Home:", homeTeamId, homeTeamAbbr, "Away:", awayTeamId, awayTeamAbbr);
  console.log("FieldDisplay - possessionText:", situation?.possessionText, "downDistanceText:", situation?.downDistanceText);
  console.log("FieldDisplay - textToCheck:", textToCheck, "isInHomeTerritory:", isInHomeTerritory);
  console.log("FieldDisplay - rawYardLine:", rawYardLine, "adjusted yardLine:", yardLine);
  console.log("FieldDisplay - possessionTeamId:", situation?.possessionTeamId, "inferred:", inferredPossessionTeamId);
  console.log("FieldDisplay - ballX:", 50 + (yardLine * 5), "ballY:", 56.35);

  // ESPN's coordinate system:
  // x=0 to x=50: Away end zone
  // x=50 to x=550: Playing field (100 yards, 5 units per yard)
  // x=550 to x=600: Home end zone
  // Ball position: x = 50 + (yardLine * 5)
  const ballX = 50 + (yardLine * 5);
  const ballY = 56.35; // Vertical center of field

  // Always show ball during live games
  const showBall = true;

  // Helper function to get team logo URL
  const getTeamLogoUrl = (teamId: string) => {
    const abbr = teamId === homeTeamId ? homeTeamAbbr?.toLowerCase() : awayTeamAbbr?.toLowerCase();
    const url = `https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/scoreboard/${abbr}.png&cquality=80&h=80&w=80`;
    console.log("FieldDisplay - getTeamLogoUrl called with teamId:", teamId, "abbr:", abbr, "url:", url);
    return url;
  };

  // Log final rendering values
  if (inferredPossessionTeamId) {
    console.log("FieldDisplay - RENDERING LOGO with ballX:", ballX, "ballY:", ballY, "transform:", `translate(${ballX}, ${ballY - 28})`);
  } else {
    console.log("FieldDisplay - NO LOGO (no possession team ID)");
  }

  return (
    <div className="FieldView">
      <svg className="FieldSVG" viewBox="0 -40 600 130">
        <defs>
          <clipPath id="clippath-field-side">
            <polygon points="599.95 90 0 90 .05 86 600 86 599.95 90"></polygon>
          </clipPath>
          <clipPath id="clippath-field-top-small">
            <path d="M45.71,84.34h508.59l-24.22-56.98H69.92l-24.22,56.98ZM548.62,82.69H51.38l22.49-53.97h452.26l22.49,53.97Z"></path>
          </clipPath>
          <clipPath id="clippath-field-top-large">
            <polygon points="575 86 25 86 52.5 26 547.5 26 575 86"></polygon>
          </clipPath>
        </defs>

        {/* Field Side (bottom view) */}
        <g data-name="Field Side">
          {/* 10-yard sections */}
          <rect className={`tenYardFill ${isRedZone && yardLine <= 20 ? 'redzone--left' : ''}`} x="50" y="86" width="50" height="4"></rect>
          <rect className={`tenYardFill tenYardFill--dark ${isRedZone && yardLine <= 20 ? 'redzone--left' : ''}`} x="100" y="86" width="50" height="4"></rect>
          <rect className="tenYardFill" x="150" y="86" width="50" height="4"></rect>
          <rect className="tenYardFill tenYardFill--dark" x="200" y="86" width="50" height="4"></rect>
          <rect className="tenYardFill" x="250" y="86" width="50" height="4"></rect>
          <rect className="tenYardFill" x="300" y="86" width="50" height="4"></rect>
          <rect className="tenYardFill tenYardFill--dark" x="350" y="86" width="50" height="4"></rect>
          <rect className="tenYardFill" x="400" y="86" width="50" height="4"></rect>
          <rect className={`tenYardFill tenYardFill--dark ${isRedZone && yardLine >= 80 ? 'redzone--right' : ''}`} x="450" y="86" width="50" height="4"></rect>
          <rect className={`tenYardFill ${isRedZone && yardLine >= 80 ? 'redzone--right' : ''}`} x="500" y="86" width="50" height="4"></rect>

          {/* End zones */}
          <rect fill={homeTeamColor} x="550" y="86" width="50" height="4"></rect>
          <rect fill={awayTeamColor} x="0" y="86" width="50" height="4"></rect>

          {/* Yard lines */}
          <g clipPath="url(#clippath-field-side)">
            <line className="tenYardLine" x1="50" y1="86" x2="50" y2="90"></line>
            <line className="tenYardLine" x1="100" y1="86" x2="100" y2="90"></line>
            <line className="tenYardLine" x1="150" y1="86" x2="150" y2="90"></line>
            <line className="tenYardLine" x1="200" y1="86" x2="200" y2="90"></line>
            <line className="tenYardLine" x1="250" y1="86" x2="250" y2="90"></line>
            <line className="tenYardLine" strokeWidth="2" x1="300" y1="86" x2="300" y2="90"></line>
            <line className="tenYardLine" x1="350" y1="86" x2="350" y2="90"></line>
            <line className="tenYardLine" x1="400" y1="86" x2="400" y2="90"></line>
            <line className="tenYardLine" x1="450" y1="86" x2="450" y2="90"></line>
            <line className="tenYardLine" x1="500" y1="86" x2="500" y2="90"></line>
            <line className="tenYardLine" x1="550" y1="86" x2="550" y2="90"></line>
          </g>

          <polygon className="side-overlay" points="599.95 90 0 90 .05 86 600 86 599.95 90"></polygon>
        </g>

        {/* Field Top (3D perspective view) */}
        <g data-name="Field Top">
          {/* 10-yard section polygons */}
          <polygon className={`tenYardFill ${isRedZone && yardLine <= 20 ? 'redzone--left' : ''}`} points="100 86 50 86 75 26 120 26 100 86"></polygon>
          <polygon className={`tenYardFill tenYardFill--dark ${isRedZone && yardLine <= 20 ? 'redzone--left' : ''}`} points="150 86 100 86 120 26 165 26 150 86"></polygon>
          <polygon className="tenYardFill" points="200 86 150 86 165 26 210 26 200 86"></polygon>
          <polygon className="tenYardFill tenYardFill--dark" points="250 86 200 86 210 26 255 26 250 86"></polygon>
          <polygon className="tenYardFill" points="300 86 250 86 255 26 300 26 300 86"></polygon>
          <polygon className="tenYardFill" points="350 86 300 86 300 26 345 26 350 86"></polygon>
          <polygon className="tenYardFill tenYardFill--dark" points="400 86 350 86 345 26 390 26 400 86"></polygon>
          <polygon className="tenYardFill" points="450 86 400 86 390 26 435 26 450 86"></polygon>
          <polygon className={`tenYardFill tenYardFill--dark ${isRedZone && yardLine >= 80 ? 'redzone--right' : ''}`} points="500 86 450 86 435 26 480 26 500 86"></polygon>
          <polygon className={`tenYardFill ${isRedZone && yardLine >= 80 ? 'redzone--right' : ''}`} points="550 86 500 86 480 26 525 26 550 86"></polygon>

          {/* End zones */}
          <polygon fill={homeTeamColor} points="600 86 550 86 525 26 570 26 600 86"></polygon>
          <polygon fill={awayTeamColor} points="50 86 0 86 30 26 75 26 50 86"></polygon>

          {/* One-yard lines (hash marks) */}
          <g clipPath="url(#clippath-field-top-small)">
            {Array.from({ length: 100 }, (_, i) => {
              if (i % 10 === 0) return null; // Skip 10-yard lines
              const x1 = 75 + (i * 4.5);
              const y1 = 26;
              const x2 = 50 + (i * 5);
              const y2 = 86;
              return <line key={i} className="oneYardLine" x1={x1} y1={y1} x2={x2} y2={y2}></line>;
            })}
          </g>

          {/* 10-yard lines */}
          <g clipPath="url(#clippath-field-top-large)">
            <line className="tenYardLine" x1="75" y1="26" x2="50" y2="86"></line>
            <line className="tenYardLine" x1="120" y1="26" x2="100" y2="86"></line>
            <line className="tenYardLine" x1="165" y1="26" x2="150" y2="86"></line>
            <line className="tenYardLine" x1="210" y1="26" x2="200" y2="86"></line>
            <line className="tenYardLine" x1="255" y1="26" x2="250" y2="86"></line>
            <line className="tenYardLine" strokeWidth="2" x1="300" y1="26" x2="300" y2="86"></line>
            <line className="tenYardLine" x1="345" y1="26" x2="350" y2="86"></line>
            <line className="tenYardLine" x1="390" y1="26" x2="400" y2="86"></line>
            <line className="tenYardLine" x1="435" y1="26" x2="450" y2="86"></line>
            <line className="tenYardLine" x1="480" y1="26" x2="500" y2="86"></line>
            <line className="tenYardLine" x1="525" y1="26" x2="550" y2="86"></line>
          </g>
        </g>

        {/* Goal posts */}
        <g>
          {/* Away goal post (left) */}
          <path fill="#6c6e6f" d="M6,48.75s0-.75,2-.75,2,.75,2,.75v8.5s0,.75-2,.75-2-.75-2-.75v-8.5Z"></path>
          <path fill="#e2ce23" d="M13,43c-2.21,0-4,1.79-4,4v2s0,.4-1,.4-1-.4-1-.4v-2c0-3.31,2.69-6,6-6h1v2h-1Z"></path>
          <path fill="#e2ce23" d="M18,10.4v26.6c0,.18-.05.36-.14.51l-6,10c-.23.39-.69.57-1.12.45-.43-.12-.73-.51-.73-.96v-30.6s0-.4,1-.4,1,.4,1,.4v26.99l4-6.67V10.4s0-.4,1-.4,1,.4,1,.4Z"></path>
          <rect fill="#e2ce23" x="11" y="42" width="2" height="2"></rect>

          {/* Home goal post (right) */}
          <path fill="#6c6e6f" d="M594,57.25s0,.75-2,.75-2-.75-2-.75v-8.5s0-.75,2-.75,2,.75,2,.75v8.5Z"></path>
          <path fill="#e2ce23" d="M586,43v-2h1c3.31,0,6,2.69,6,6v2s0,.4-1,.4-1-.4-1-.4v-2c0-2.21-1.79-4-4-4h-1Z"></path>
          <path fill="#e2ce23" d="M583,10c1,0,1,.4,1,.4v26.32s4,6.67,4,6.67v-26.99s0-.4,1-.4,1,.4,1,.4v30.6c0,.45-.3.84-.73.96-.43.12-.89-.06-1.12-.45l-6-10c-.09-.16-.14-.33-.14-.51V10.4s0-.4,1-.4Z"></path>
          <rect fill="#e2ce23" x="587" y="42" width="2" height="2"></rect>
        </g>

        {/* End zone team names - rotated 90 degrees like ESPN */}
        <g className="EndzoneTeamNames EndzoneTeamNames--away EndzoneTeamNames--desktop">
          <svg x="0" y="35" width="50" height="45">
            <g className="EndzoneTeamNames__scale EndzoneTeamNames__scale--medium">
              <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" className="EndzoneTeamNames__text" transform="rotate(-90 25 22.5)">
                {awayTeamAbbr}
              </text>
            </g>
          </svg>
        </g>
        <g className="EndzoneTeamNames EndzoneTeamNames--home EndzoneTeamNames--desktop">
          <svg x="550" y="35" width="50" height="45">
            <g className="EndzoneTeamNames__scale EndzoneTeamNames__scale--large">
              <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" className="EndzoneTeamNames__text" transform="rotate(-90 25 22.5)">
                {homeTeamAbbr}
              </text>
            </g>
          </svg>
        </g>

        {/* Ball marker */}
        {showBall && (
          <g>
            {/* Drive start line */}
            <path className="DriveStart" d={`M ${ballX} ${ballY} L ${ballX} ${ballY}`}></path>

            {/* Ball symbol */}
            <g transform={`translate(${ballX}, ${ballY})`}>
              <g filter="url(#ballfilter)">
                <path className="BallDefs__Ball" d="m 0.3 2.861 c 3.3691 0 4.655 -2.961 4.655 -2.961 s -1.2859 -2.961 -4.655 -2.961 c -3.3684 0 -4.655 2.961 -4.655 2.961 s 1.2866 2.961 4.655 2.961 z"></path>
              </g>
              <path className="BallDefs__Laces" fillRule="evenodd" d="m -1.333 -1.584 c 0 -0.0875 0.0595 -0.1645 0.1449 -0.1855 a 6.1355 6.1355 90 0 1 2.9764 0 c 0.0854 0.021 0.1449 0.098 0.1449 0.1855 v 0.4361 a 0.2044 0.2044 90 0 1 -0.2289 0.203 l -0.595 -0.0749 a 6.5338 6.5338 90 0 0 -1.6184 0 l -0.595 0.0742 a 0.2044 0.2044 90 0 1 -0.2289 -0.203 v -0.4354 z" clipRule="evenodd"></path>
            </g>

            {/* Team logo bubble */}
            {inferredPossessionTeamId && (
              <g className="TeamLogoBubble fadeIn" transform={`translate(${ballX}, ${ballY - 28})`}>
                <path
                  fill="rgba(0, 0, 0, 0.8)"
                  stroke="white"
                  className="TeamLogoBubble__bubble"
                  d="m 15.75 0 c 0 4.2109 -1.849 8.0522 -4.6867 11.8181 c -2.5442 3.3764 -5.8644 6.6689 -9.3217 10.0974 c -0.4018 0.3984 -0.8053 0.7986 -1.2098 1.2011 c -0.294 0.2925 -0.7696 0.2925 -1.0636 0 c -0.4044 -0.4025 -0.808 -0.8027 -1.2098 -1.2011 c -3.4573 -3.4285 -6.7775 -6.7209 -9.3217 -10.0974 c -2.8376 -3.7659 -4.6867 -7.6072 -4.6867 -11.8181 c 0 -8.6985 7.0515 -15.75 15.75 -15.75 c 8.6985 0 15.75 7.0515 15.75 15.75 z">
                </path>
                <image
                  className="TeamLogoBubble__image"
                  xlinkHref={getTeamLogoUrl(inferredPossessionTeamId)}
                  preserveAspectRatio="none"
                  x="-11.5"
                  y="-11.5"
                  width="23"
                  height="23">
                </image>
                <path className="TeamLogoBubble__arrow" d="m 0 28 l 6 -6.5 l -12 0 z"></path>
              </g>
            )}
          </g>
        )}

        {/* Filter definitions */}
        <defs>
          <filter id="ballfilter" width="13.3" height="10.208" x="-4.35" y="-3.979" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse">
            <feFlood floodOpacity="0" result="BackgroundImageFix"></feFlood>
            <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"></feBlend>
            <feColorMatrix in="SourceAlpha" result="hardAlpha" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"></feColorMatrix>
            <feOffset dy="-1.75"></feOffset>
            <feGaussianBlur stdDeviation="1.167"></feGaussianBlur>
            <feComposite in2="hardAlpha" k2="-1" k3="1" operator="arithmetic"></feComposite>
            <feColorMatrix values="0 0 0 0 0.168627 0 0 0 0 0.172549 0 0 0 0 0.176471 0 0 0 1 0"></feColorMatrix>
            <feBlend in2="shape" result="effect1_innerShadow_1690_30900"></feBlend>
          </filter>
        </defs>
      </svg>

      {/* Field markers */}
      <div className="FieldView__markers">
        <div className="FieldView__markers__awayteam">
          <span>{awayTeamAbbr}</span>
        </div>
        <div className="FieldView__markers__10 hide-mobile">
          <span>10</span>
        </div>
        <div className="FieldView__markers__20">
          <span>20</span>
        </div>
        <div className="FieldView__markers__30 hide-mobile">
          <span>30</span>
        </div>
        <div className="FieldView__markers__40 hide-mobile">
          <span>40</span>
        </div>
        <div className="FieldView__markers__50">
          <span>50</span>
        </div>
        <div className="FieldView__markers__60 hide-mobile">
          <span>40</span>
        </div>
        <div className="FieldView__markers__70 hide-mobile">
          <span>30</span>
        </div>
        <div className="FieldView__markers__80">
          <span>20</span>
        </div>
        <div className="FieldView__markers__90 hide-mobile">
          <span>10</span>
        </div>
        <div className="FieldView__markers__hometeam">
          <span>{homeTeamAbbr}</span>
        </div>
      </div>
    </div>
  );
}
