/*
-- SQL Schema for Supabase CricOverlay

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tournaments
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  name TEXT NOT NULL,
  location TEXT,
  format TEXT DEFAULT 'T20', -- T20, ODI, Test, Custom
  overs INTEGER DEFAULT 20,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'Upcoming', -- Upcoming, Active, Completed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Teams
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_name TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Players
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT, -- Batsman, Bowler, All-rounder, Wicket-keeper
  jersey_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Matches
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  team_a_id UUID REFERENCES teams(id),
  team_b_id UUID REFERENCES teams(id),
  venue TEXT,
  date_time TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'Upcoming', -- Upcoming, Live, Completed, Abandoned
  toss_winner_id UUID REFERENCES teams(id),
  toss_decision TEXT, -- Batting, Bowling
  overs_per_innings INTEGER DEFAULT 20,
  current_innings INTEGER DEFAULT 1,
  
  -- Live Score Cache (for performance)
  score_a TEXT DEFAULT '0/0 (0.0)',
  score_b TEXT DEFAULT '0/0 (0.0)',
  current_score TEXT DEFAULT '0/0 (0.0)',
  
  result TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Balls (Scoring)
CREATE TABLE balls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  innings INTEGER NOT NULL,
  over_number INTEGER NOT NULL,
  ball_number INTEGER NOT NULL,
  bowler_id UUID REFERENCES players(id),
  batter_id UUID REFERENCES players(id),
  non_striker_id UUID REFERENCES players(id),
  runs INTEGER DEFAULT 0,
  extra_runs INTEGER DEFAULT 0,
  extra_type TEXT, -- Wide, No-ball, Bye, Leg-bye
  is_wicket BOOLEAN DEFAULT FALSE,
  wicket_type TEXT, -- Bowled, Caught, LBW, Run-out, Stumped
  wicket_player_id UUID REFERENCES players(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- --- SECURITY POLICIES (RLS) ---

-- Enable RLS on all tables
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE balls ENABLE ROW LEVEL SECURITY;

-- Tournaments: Users can only manage their own tournaments
CREATE POLICY "Users can manage their own tournaments" ON tournaments
  FOR ALL USING (auth.uid() = user_id);

-- Teams: Public read, but only tournament owner can manage
CREATE POLICY "Public read teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Tournament owners can manage teams" ON teams
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tournaments 
      WHERE tournaments.id = teams.tournament_id 
      AND tournaments.user_id = auth.uid()
    )
  );

-- Players: Public read, but only tournament owner can manage
CREATE POLICY "Public read players" ON players FOR SELECT USING (true);
CREATE POLICY "Tournament owners can manage players" ON players
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM teams 
      JOIN tournaments ON teams.tournament_id = tournaments.id
      WHERE teams.id = players.team_id 
      AND tournaments.user_id = auth.uid()
    )
  );

-- Matches: Public read, but only tournament owner can manage
CREATE POLICY "Public read matches" ON matches FOR SELECT USING (true);
CREATE POLICY "Tournament owners can manage matches" ON matches
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tournaments 
      WHERE tournaments.id = matches.tournament_id 
      AND tournaments.user_id = auth.uid()
    )
  );

-- Balls: Public read, but only tournament owner can manage
CREATE POLICY "Public read balls" ON balls FOR SELECT USING (true);
CREATE POLICY "Tournament owners can manage balls" ON balls
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM matches
      JOIN tournaments ON matches.tournament_id = tournaments.id
      WHERE matches.id = balls.match_id 
      AND tournaments.user_id = auth.uid()
    )
  );

-- Enable Realtime for balls and matches
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE balls;
*/
