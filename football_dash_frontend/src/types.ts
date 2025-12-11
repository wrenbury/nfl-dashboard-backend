// football_dash_frontend/src/types.ts

export type GameSituation = {
  clock?: string | null;
  period?: number | null;
  down?: number | null;
  distance?: number | null;
  yardLine?: number | null;
  shortDownDistanceText?: string | null;
  downDistanceText?: string | null;
  possessionTeamId?: string | null;
  possessionText?: string | null;
  isRedZone?: boolean | null;
};

export type Team = {
  id: string;
  name: string;
  nickname?: string | null;
  abbreviation?: string | null;
  color?: string | null;
  logo?: string | null;
  record?: string | null;
  rank?: number | null;
};

export type Competitor = {
  team: Team;
  homeAway: "home" | "away";
  score?: number | null;
  winner?: boolean | null;
};

export type GameSummary = {
  id: string;
  sport: "nfl" | "college-football";
  startTime: string;
  status: string;
  venue?: string | null;
  competitors: Competitor[];
};

export type BoxScoreCategory = {
  title: string;
  headers?: string[];
  rows: string[][];
};

export type GameDetails = {
  summary: GameSummary;
  boxscore: BoxScoreCategory[];
  teamStats: BoxScoreCategory[];
  plays?: any[] | null;
  winProbability?: any[] | null;
  situation?: GameSituation | null;
};
