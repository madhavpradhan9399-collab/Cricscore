export type TournamentFormat = 'T20' | 'ODI' | 'Test' | 'Custom';

export interface Tournament {
  id: string;
  name: string;
  location: string;
  format: TournamentFormat;
  overs: number;
  start_date: string;
  end_date: string;
  created_at: string;
  user_id: string;
}

export interface Team {
  id: string;
  tournament_id: string;
  name: string;
  short_name: string;
  logo_url?: string;
  created_at: string;
}

export interface Player {
  id: string;
  team_id: string;
  name: string;
  role: 'Batsman' | 'Bowler' | 'All-rounder' | 'WK';
  jersey_number?: string;
  created_at: string;
}

export interface Match {
  id: string;
  tournament_id: string;
  team_a_id: string;
  team_b_id: string;
  venue: string;
  date_time: string;
  status: 'Upcoming' | 'Live' | 'Completed';
  toss_winner_id?: string;
  toss_decision?: 'Bat' | 'Bowl';
  overs_per_innings: number;
  current_innings: number;
  created_at: string;
}

export interface Ball {
  id: string;
  match_id: string;
  innings: number;
  over_number: number;
  ball_number: number;
  bowler_id: string;
  batter_id: string;
  non_striker_id: string;
  runs: number;
  extra_runs: number;
  extra_type?: 'Wide' | 'No Ball' | 'Bye' | 'Leg Bye' | 'Penalty';
  is_wicket: boolean;
  wicket_type?: 'Bowled' | 'Caught' | 'LBW' | 'Run Out' | 'Stumped' | 'Hit Wicket' | 'Other';
  wicket_player_id?: string;
  created_at: string;
}

export interface ScoreState {
  runs: number;
  wickets: number;
  overs: number;
  balls: number;
  target?: number;
  crr: number;
  rrr?: number;
}
