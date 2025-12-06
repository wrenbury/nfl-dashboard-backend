export type League = "NFL" | "CFB";

export type StatusState =
  | "pre"
  | "in"
  | "post"
  | "halftime"
  | "final"
  | "delayed";

export type PossessionSide = "home" | "away";

export type TeamSide = "home" | "away";

export type ScoringPlayType =
  | "TD"
  | "FG"
  | "Safety"
  | "XP"
  | "2PT"
  | "Other";

// Team summary / header
export interface TeamSummary {
  id: string;
  name: string;
  full_name: string;
  abbreviation: string;
  record?: string | null;
  score: number;
}

export interface TeamHeader extends TeamSummary {}

// /games/today
export interface TodayGame {
  game_id: string;
  league: League;
  season: number | null;
  week: number | null;
  status: StatusState;
  quarter: number | null;
  clock: string | null;
  kickoff_time_utc: string | null;
  home_team: TeamSummary;
  away_team: TeamSummary;
  red_zone: boolean;
}

export interface GamesTodayResponse {
  games: TodayGame[];
}

// /games/{id}/live
export interface Header {
  game_id: string;
  league: League;
  season: number;
  week?: number | null;
  status: StatusState;
  kickoff_time_utc?: string | null;
  home_team: TeamHeader;
  away_team: TeamHeader;
  quarter?: number | null;
  clock?: string | null;
  possession?: PossessionSide | null;
  down?: number | null;
  distance?: number | null;
  yard_line?: number | null;
  red_zone: boolean;
  home_timeouts?: number | null;
  away_timeouts?: number | null;
  last_play_short?: string | null;
  last_updated_utc: string;
}

export interface DriveSummary {
  id: string;
  team: TeamSide;
  result?: string | null;
  plays?: number | null;
  yards?: number | null;
  time_of_possession?: string | null;
}

export interface CurrentDrive {
  id: string;
  team: TeamSide;
  plays?: number | null;
  yards?: number | null;
  time_of_possession?: string | null;
  red_zone?: boolean | null;
  clock?: string | null;
  quarter?: number | null;
  down?: number | null;
  distance?: number | null;
  yard_line?: number | null;
}

export interface Drives {
  current_drive_id?: string | null;
  summary: DriveSummary[];
  current?: CurrentDrive | null;
}

export interface ScoringByQuarter {
  quarter: number;
  home_points: number;
  away_points: number;
}

export interface ScoringPlay {
  id: string;
  quarter: number;
  clock: string;
  team: TeamSide;
  type: ScoringPlayType;
  description: string;
  yards?: number | null;
  player_primary?: string | null;
}

export interface TouchdownScorer {
  player: string;
  team: TeamSide;
  count: number;
}

export interface Scoring {
  summary_by_quarter: ScoringByQuarter[];
  plays: ScoringPlay[];
  touchdown_scorers: TouchdownScorer[];
}

export interface TeamStats {
  total_yards?: number | null;
  plays?: number | null;
  yards_per_play?: number | null;
  passing_yards?: number | null;
  rushing_yards?: number | null;
  turnovers?: number | null;
  penalties?: number | null;
  penalty_yards?: number | null;
  third_down_made?: number | null;
  third_down_attempts?: number | null;
  red_zone_trips?: number | null;
  red_zone_tds?: number | null;
  time_of_possession?: string | null;
}

export interface TeamStatsWrapper {
  home: TeamStats;
  away: TeamStats;
}

export interface PassingStat {
  player: string;
  team: TeamSide;
  completions: number;
  attempts: number;
  yards: number;
  touchdowns: number;
  interceptions: number;
}

export interface RushingStat {
  player: string;
  team: TeamSide;
  carries: number;
  yards: number;
  touchdowns: number;
}

export interface ReceivingStat {
  player: string;
  team: TeamSide;
  receptions: number;
  yards: number;
  touchdowns: number;
}

export interface PlayerStats {
  passing: PassingStat[];
  rushing: RushingStat[];
  receiving: ReceivingStat[];
}

export interface Boxscore {
  team_stats: TeamStatsWrapper;
  player_stats: PlayerStats;
}

export interface Venue {
  name?: string | null;
  city?: string | null;
  state?: string | null;
  indoor?: boolean | null;
}

export interface Broadcast {
  network?: string | null;
  stream?: string | null;
}

export interface Weather {
  description?: string | null;
  temperature_f?: number | null;
  wind_mph?: number | null;
  humidity_pct?: number | null;
}

export interface Meta {
  venue: Venue;
  broadcast: Broadcast;
  weather: Weather;
}

export interface WinProbability {
  home?: number | null;
  away?: number | null;
  last_updated_utc?: string | null;
}

export interface CurrentSituation {
  description?: string | null;
  short_description?: string | null;
  team?: TeamSide | null;
  down?: number | null;
  distance?: number | null;
  yard_line?: number | null;
  clock?: string | null;
  quarter?: number | null;
  red_zone?: boolean | null;
}

export interface TeamSuccessRates {
  success_rate?: number | null;
  explosive_play_rate?: number | null;
  epa_per_play?: number | null;
}

export interface TeamSuccessRatesWrapper {
  home: TeamSuccessRates;
  away: TeamSuccessRates;
}

export interface Analytics {
  win_probability: WinProbability;
  current_situation?: CurrentSituation | null;
  team_success_rates: TeamSuccessRatesWrapper;
}

export interface GameLiveResponse {
  header: Header;
  drives: Drives;
  scoring: Scoring;
  boxscore: Boxscore;
  meta: Meta;
  analytics: Analytics;
}
