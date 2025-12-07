// football_dash_frontend/src/types/api.ts

// ----------------------
// Shared / NFL types
// ----------------------

export type League = "NFL" | "CFB";

export type StatusState =
  | "pre"
  | "in"
  | "post"
  | "halftime"
  | "final"
  | "delayed";

export type Quarter = 1 | 2 | 3 | 4 | 5 | null;

export interface TeamSummary {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string | null;
  logoUrl: string | null;
  record: string | null;
  score: number | null;
  conference?: string | null;
}

export interface TodayGame {
  game_id: string;
  league: "NFL";
  season: number;
  week: number;
  status: StatusState;
  quarter: Quarter;
  clock: string | null;
  kickoff_time_utc: string | null;
  neutral_site: boolean;

  home_team: TeamSummary;
  away_team: TeamSummary;

  venue_name?: string | null;
  tv_network?: string | null;
}

export interface GamesTodayResponse {
  games: TodayGame[];
}

// ----------------------
// GameLiveResponse (NFL)
// ----------------------

export interface GameHeader {
  game_id: string;
  league: "NFL";
  season: number;
  week: number | null;
  state: StatusState;
  quarter: Quarter;
  clock: string | null;
  scheduled_utc: string | null;
  venue_name: string | null;

  home_team: TeamSummary;
  away_team: TeamSummary;

  possession: "home" | "away" | null;
  down: number | null;
  distance: number | null;
  yard_line: number | null;
  red_zone: boolean;
  home_timeouts: number | null;
  away_timeouts: number | null;
  last_play_short: string | null;
}

export interface DriveSummary {
  id: string;
  team: "home" | "away";
  quarter: Quarter;
  result: string | null;
  plays: number | null;
  yards: number | null;
  time_of_possession: string | null;
}

export interface ScoringByQuarter {
  quarter: Quarter;
  home_points: number;
  away_points: number;
}

export type ScoringPlayType = "TD" | "FG" | "Safety" | "XP" | "2PT" | "Other";

export interface ScoringPlay {
  id: string;
  quarter: Quarter;
  clock: string | null;
  team: "home" | "away";
  type: ScoringPlayType;
  description: string;
  yards: number | null;
  player_primary: string | null;
}

export interface TdScorer {
  player: string;
  team: "home" | "away" | null;
  touchdowns: number;
}

export interface ScoringSummary {
  summary_by_quarter: ScoringByQuarter[];
  plays: ScoringPlay[];
  td_scorers: TdScorer[];
}

export interface TeamStats {
  total_yards: number | null;
  plays: number | null;
  yards_per_play: number | null;
  passing_yards: number | null;
  rushing_yards: number | null;
  turnovers: number | null;
  penalties: number | null;
  penalty_yards: number | null;
  third_down_made: number | null;
  third_down_attempts: number | null;
  red_zone_trips: number | null;
  red_zone_tds: number | null;
  time_of_possession: string | null;
}

export interface TeamStatsPair {
  home: TeamStats;
  away: TeamStats;
}

export interface PlayerPassingStatLine {
  player_id: string | null;
  name: string;
  team: "home" | "away";
  completions: number | null;
  attempts: number | null;
  yards: number | null;
  touchdowns: number | null;
  interceptions: number | null;
}

export interface PlayerRushingStatLine {
  player_id: string | null;
  name: string;
  team: "home" | "away";
  carries: number | null;
  yards: number | null;
  touchdowns: number | null;
}

export interface PlayerReceivingStatLine {
  player_id: string | null;
  name: string;
  team: "home" | "away";
  receptions: number | null;
  yards: number | null;
  touchdowns: number | null;
}

export interface PlayerStats {
  passing: PlayerPassingStatLine[];
  rushing: PlayerRushingStatLine[];
  receiving: PlayerReceivingStatLine[];
}

export interface Boxscore {
  team_stats: TeamStatsPair;
  player_stats: PlayerStats;
}

export interface WeatherMeta {
  description: string | null;
  temperature_f: number | null;
  wind_mph: number | null;
}

export interface SiteMeta {
  provider: string;
  weather: WeatherMeta;
}

export interface WinProbabilityPoint {
  quarter: Quarter;
  clock: string | null;
  home_win_pct: number;
}

export interface WinProbability {
  current: number | null;
  series: WinProbabilityPoint[];
}

export interface TeamAnalytics {
  success_rate: number | null;
  explosive_play_rate: number | null;
  epa_per_play: number | null;
}

export interface AnalyticsSummary {
  win_probability: WinProbability | null;
  team_success_rates: {
    home: TeamAnalytics;
    away: TeamAnalytics;
  };
}

export interface GameLiveResponse {
  header: GameHeader;
  drives: DriveSummary[];
  scoring: ScoringSummary;
  boxscore: Boxscore;
  meta: SiteMeta;
  analytics: AnalyticsSummary;
}

// ----------------------
// CFB scoreboard types
// ----------------------

export interface CfbScoreboardGameTeam {
  id: string;
  name: string;
  short_name: string;
  abbreviation: string | null;
  logo_url?: string | null;
  rank?: number | null;
  record?: string | null;
  score: number | null;
  conference?: string | null;
}

export interface CfbScoreboardGame {
  game_id: string;
  league: "CFB";
  season: number;
  week: number;

  status: StatusState;
  quarter: number | null;
  clock: string | null;
  kickoff_time_utc: string | null;
  neutral_site: boolean;

  home_team: CfbScoreboardGameTeam;
  away_team: CfbScoreboardGameTeam;

  venue_name?: string | null;
  tv_network?: string | null;
}

export interface CfbScoreboardResponse {
  season: number;
  week: number;
  games: CfbScoreboardGame[];
}
