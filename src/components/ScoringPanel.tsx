import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Plus, 
  Minus, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  User,
  Zap,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

interface ScoringPanelProps {
  matchId: string;
  user: any;
}

export const ScoringPanel: React.FC<ScoringPanelProps> = ({ matchId, user }) => {
  const [match, setMatch] = useState<any>(null);
  const [runs, setRuns] = useState(0);
  const [wickets, setWickets] = useState(0);
  const [overs, setOvers] = useState(0);
  const [balls, setBalls] = useState(0);
  const [target, setTarget] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [currentBatter, setCurrentBatter] = useState<any>(null);
  const [nonStriker, setNonStriker] = useState<any>(null);
  const [currentBowler, setCurrentBowler] = useState<any>(null);
  const [teamAPlayers, setTeamAPlayers] = useState<any[]>([]);
  const [teamBPlayers, setTeamBPlayers] = useState<any[]>([]);
  const [selectedTeamForPlayers, setSelectedTeamForPlayers] = useState<any | null>(null);
  const [showBatterSelect, setShowBatterSelect] = useState(false);
  const [showNonStrikerSelect, setShowNonStrikerSelect] = useState(false);
  const [showBowlerSelect, setShowBowlerSelect] = useState(false);
  const [playerStats, setPlayerStats] = useState<Record<string, any>>({});
  const [currentOverBalls, setCurrentOverBalls] = useState<any[]>([]);
  const [tossWinnerId, setTossWinnerId] = useState<string>('');
  const [tossDecision, setTossDecision] = useState<string>('');
  const [updatingToss, setUpdatingToss] = useState(false);
  const [endingInnings, setEndingInnings] = useState(false);
  const [resettingMatch, setResettingMatch] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState('emerald');
  const [isQuickScoreMinimized, setIsQuickScoreMinimized] = useState(false);
  const [isThemesMinimized, setIsThemesMinimized] = useState(false);
  const [isExtrasMinimized, setIsExtrasMinimized] = useState(false);
  const [isTossMinimized, setIsTossMinimized] = useState(false);
  const [isInningsMinimized, setIsInningsMinimized] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ 
    show: boolean; 
    title: string; 
    message: string; 
    onConfirm: () => void; 
    type: 'danger' | 'info'; 
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => {
        setStatusMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  useEffect(() => {
    fetchMatch();

    // Real-time listener for this specific match
    const matchChannel = supabase
      .channel(`match-${matchId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        table: 'matches', 
        schema: 'public',
        filter: `id=eq.${matchId}`
      }, (payload) => {
        setMatch((prev: any) => ({ ...prev, ...payload.new }));
      })
      .subscribe();

    // Real-time listener for balls in this match
    const ballsChannel = supabase
      .channel(`balls-${matchId}`)
      .on('postgres_changes', {
        event: '*',
        table: 'balls',
        schema: 'public',
        filter: `match_id=eq.${matchId}`
      }, () => {
        // Refresh match data to get latest score cache and balls
        fetchMatch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(matchChannel);
      supabase.removeChannel(ballsChannel);
    };
  }, [matchId]);

  const getBattingPlayers = () => {
    if (!match || !tossWinnerId || !tossDecision) return teamAPlayers;
    
    const isTeamAWinner = tossWinnerId === match.team_a_id;
    const teamABatsFirst = (isTeamAWinner && tossDecision === 'Batting') || (!isTeamAWinner && tossDecision === 'Bowling');
    
    const currentInnings = match.current_innings || 1;
    
    if (currentInnings === 1) {
      return teamABatsFirst ? teamAPlayers : teamBPlayers;
    } else {
      return teamABatsFirst ? teamBPlayers : teamAPlayers;
    }
  };

  const getBowlingPlayers = () => {
    if (!match || !tossWinnerId || !tossDecision) return teamBPlayers;
    
    const isTeamAWinner = tossWinnerId === match.team_a_id;
    const teamABatsFirst = (isTeamAWinner && tossDecision === 'Batting') || (!isTeamAWinner && tossDecision === 'Bowling');
    
    const currentInnings = match.current_innings || 1;
    
    if (currentInnings === 1) {
      return teamABatsFirst ? teamBPlayers : teamAPlayers;
    } else {
      return teamABatsFirst ? teamAPlayers : teamBPlayers;
    }
  };

  const fetchMatch = async (retries = 3) => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    if (!url || url === 'https://placeholder.supabase.co') {
      setLoading(false);
      return;
    }

    if (!matchId || matchId === 'undefined' || matchId === 'null') {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*, team_a:teams!team_a_id(name, id), team_b:teams!team_b_id(name, id), tournament:tournaments(*)')
        .eq('id', matchId)
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .single();
      
      if (error) {
        console.error('Error fetching match:', error);
        if (error.code === 'PGRST116') {
          setError('Match not found or you do not have permission to score this match.');
          setLoading(false);
          return;
        }
        if (retries > 0) {
          setTimeout(() => fetchMatch(retries - 1), 2000);
        } else {
          setError('Failed to load match data. Please check your connection.');
          setLoading(false);
        }
        return;
      }
      
      if (data) {
        setError(null);
        setMatch(data);
      setTossWinnerId(data.toss_winner_id || '');
      setTossDecision(data.toss_decision || '');
      
      // Fetch players for both teams
      let pA = null;
      let pB = null;
      
      if (data.team_a_id) {
        const { data: playersA } = await supabase.from('players').select('*').eq('team_id', data.team_a_id);
        pA = playersA;
      }
      
      if (data.team_b_id) {
        const { data: playersB } = await supabase.from('players').select('*').eq('team_id', data.team_b_id);
        pB = playersB;
      }
      
      if (pA) setTeamAPlayers(pA);
      if (pB) setTeamBPlayers(pB);

      // Determine initial players based on toss and innings
      if (pA && pB && data.toss_winner_id && data.toss_decision) {
        const isTeamAWinner = data.toss_winner_id === data.team_a_id;
        const teamABatsFirst = (isTeamAWinner && data.toss_decision === 'Batting') || (!isTeamAWinner && data.toss_decision === 'Bowling');
        const currentInnings = data.current_innings || 1;
        
        const battingTeam = currentInnings === 1 
          ? (teamABatsFirst ? pA : pB) 
          : (teamABatsFirst ? pB : pA);
        
        const bowlingTeam = currentInnings === 1 
          ? (teamABatsFirst ? pB : pA) 
          : (teamABatsFirst ? pA : pB);

        setCurrentBatter(battingTeam[0]);
        setNonStriker(battingTeam[1]);
        setCurrentBowler(bowlingTeam[0]);
      } else if (pA && pB) {
        // Fallback if toss not decided
        setCurrentBatter(pA[0]);
        setNonStriker(pA[1]);
        setCurrentBowler(pB[0]);
      }

      // Fetch all balls to calculate stats
      const { data: ballsData } = await supabase
        .from('balls')
        .select(`
          *,
          batter:players!balls_batter_id_fkey(id, name),
          non_striker:players!balls_non_striker_id_fkey(id, name),
          bowler:players!balls_bowler_id_fkey(id, name)
        `)
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });

      if (ballsData && ballsData.length > 0) {
        const stats: Record<string, any> = {};
        let firstInningsRuns = 0;
        let totalBallsInInnings = 0;
        const currentInnings = data.current_innings || 1;

        ballsData.forEach((ball: any) => {
          if (ball.innings === 1) {
            firstInningsRuns += (ball.runs || 0) + (ball.extra_runs || 0);
          }
          
          if (ball.innings === currentInnings) {
            if (ball.batter_id) {
              if (!stats[ball.batter_id]) stats[ball.batter_id] = { runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, runsConceded: 0, ballsBowled: 0 };
              stats[ball.batter_id].runs += (ball.runs || 0);
              if (!ball.extra_type || ball.extra_type === 'No Ball') {
                stats[ball.batter_id].balls += 1;
              }
              if (ball.runs === 4) stats[ball.batter_id].fours += 1;
              if (ball.runs === 6) stats[ball.batter_id].sixes += 1;
            }
            if (ball.bowler_id) {
              if (!stats[ball.bowler_id]) stats[ball.bowler_id] = { runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, runsConceded: 0, ballsBowled: 0 };
              stats[ball.bowler_id].runsConceded += (ball.runs || 0) + (ball.extra_runs || 0);
              if (!ball.extra_type || ball.extra_type === 'Bye' || ball.extra_type === 'Leg Bye') {
                stats[ball.bowler_id].ballsBowled += 1;
                totalBallsInInnings += 1;
              }
              if (ball.is_wicket) stats[ball.bowler_id].wickets += 1;
            }
          }
        });
        setPlayerStats(stats);
        if (data.current_innings === 2) {
          setTarget(firstInningsRuns + 1);
        } else {
          setTarget(null);
        }

        // Derive current players from last ball
        const currentInningsBalls = ballsData.filter(b => b.innings === currentInnings);
        
        // Parse current strikers from current_score if available
        let strikerIdFromScore: string | null = null;
        let nsIdFromScore: string | null = null;
        
        if (data.current_score) {
          const strikerMatch = data.current_score.match(/\|S:([^|]+)/);
          const nsMatch = data.current_score.match(/\|NS:([^|]+)/);
          if (strikerMatch) strikerIdFromScore = strikerMatch[1];
          if (nsMatch) nsIdFromScore = nsMatch[1];
        }

        if (currentInningsBalls.length > 0) {
          const lastBall = currentInningsBalls[currentInningsBalls.length - 1];
          let s = lastBall.batter;
          let ns = lastBall.non_striker;
          let b = lastBall.bowler;

          // Rotate strike if runs were odd
          if ((lastBall.runs || 0) % 2 !== 0) {
            [s, ns] = [ns, s];
          }

          // Rotate strike if over ended
          const isExtraThatDoesntCount = lastBall.extra_type === 'Wide' || lastBall.extra_type === 'No Ball';
          if (totalBallsInInnings % 6 === 0 && !isExtraThatDoesntCount) {
            [s, ns] = [ns, s];
          }

          // Override with IDs from score if they exist
          if (strikerIdFromScore) {
            const foundStriker = [...teamAPlayers, ...teamBPlayers].find(p => p.id === strikerIdFromScore);
            if (foundStriker) s = foundStriker;
          }
          if (nsIdFromScore) {
            const foundNS = [...teamAPlayers, ...teamBPlayers].find(p => p.id === nsIdFromScore);
            if (foundNS) ns = foundNS;
          }

          if (s) setCurrentBatter(s);
          if (ns) setNonStriker(ns);
          if (b) setCurrentBowler(b);

          // If last ball was a wicket, we need to select a new batter
          if (lastBall.is_wicket) {
            setShowBatterSelect(true);
          }
        } else if (pA && pB) {
          // No balls in current innings yet, use initial players
          const isTeamAWinner = data.toss_winner_id === data.team_a_id;
          const teamABatsFirst = (isTeamAWinner && data.toss_decision === 'Batting') || (!isTeamAWinner && data.toss_decision === 'Bowling');
          
          const battingTeam = currentInnings === 1 
            ? (teamABatsFirst ? pA : pB) 
            : (teamABatsFirst ? pB : pA);
          
          const bowlingTeam = currentInnings === 1 
            ? (teamABatsFirst ? pB : pA) 
            : (teamABatsFirst ? pA : pB);

          let s = battingTeam[0];
          let ns = battingTeam[1];
          
          if (strikerIdFromScore) {
            const foundStriker = [...pA, ...pB].find(p => p.id === strikerIdFromScore);
            if (foundStriker) s = foundStriker;
          }
          if (nsIdFromScore) {
            const foundNS = [...pA, ...pB].find(p => p.id === nsIdFromScore);
            if (foundNS) ns = foundNS;
          }

          setCurrentBatter(s);
          setNonStriker(ns);
          setCurrentBowler(bowlingTeam[0]);
        }
      } else if (pA && pB) {
        // Fallback if no balls found at all
        const isTeamAWinner = data.toss_winner_id === data.team_a_id;
        const teamABatsFirst = (isTeamAWinner && data.toss_decision === 'Batting') || (!isTeamAWinner && data.toss_decision === 'Bowling');
        
        setCurrentBatter(teamABatsFirst ? pA[0] : pB[0]);
        setNonStriker(teamABatsFirst ? pA[1] : pB[1]);
        setCurrentBowler(teamABatsFirst ? pB[0] : pA[0]);
      }

      // Fetch current over balls
      const currentInningsBalls = ballsData?.filter(b => b.innings === (data.current_innings || 1)) || [];
      let displayOverNum = data.current_score ? parseInt(data.current_score.match(/\((\d+)\./)?.[1] || '0') : 0;
      
      // Only show balls for the current over
      let currentOverBallsData = currentInningsBalls.filter(b => b.over_number === displayOverNum);
      
      if (currentOverBallsData.length > 0) {
        setCurrentOverBalls(currentOverBallsData
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .map(b => b.is_wicket ? 'W' : (b.extra_type ? (b.extra_type === 'Wide' ? 'WD' : 'NB') : b.runs.toString()))
        );
      } else {
        // Clear tracker if current over has no balls (e.g. start of new over)
        setCurrentOverBalls([]);
      }

      // Parse score cache
      if (data.current_score) {
        const matchScore = data.current_score.match(/(\d+)\/(\d+)\s+\((\d+)\.(\d+)\)/);
        if (matchScore) {
          setRuns(parseInt(matchScore[1]));
          setWickets(parseInt(matchScore[2]));
          setOvers(parseInt(matchScore[3]));
          setBalls(parseInt(matchScore[4]));
        }
      }
    }
  } catch (err: any) {
      console.error('Network error fetching match:', err);
      if (retries > 0) {
        setTimeout(() => fetchMatch(retries - 1), 2000);
      }
    }
    setLoading(false);
  };

  const updateMatchScore = async (newRuns: number, newWickets: number, newOvers: number, newBalls: number, strikerId?: string, nsId?: string, bowlerId?: string) => {
    const sId = strikerId || currentBatter?.id;
    const nId = nsId || nonStriker?.id;
    const bId = bowlerId || currentBowler?.id;
    const scoreStr = `${newRuns}/${newWickets} (${newOvers}.${newBalls})${sId ? `|S:${sId}` : ''}${nId ? `|NS:${nId}` : ''}${bId ? `|B:${bId}` : ''}`;
    await supabase
      .from('matches')
      .update({ 
        current_score: scoreStr
      })
      .eq('id', matchId)
      .or(`user_id.eq.${user.id},user_id.is.null`);
  };

  const addBall = async (run: number, isExtra: boolean = false, extraType?: string) => {
    let nextRuns = runs;
    let nextWickets = wickets;
    let nextOvers = overs;
    let nextBalls = balls;

    if (!isExtra) {
      nextRuns += run;
      if (nextBalls === 5) {
        nextOvers += 1;
        nextBalls = 0;
      } else {
        nextBalls += 1;
      }
    } else {
      nextRuns += run + 1; // Extra + 1 run for wide/no ball
    }

    setRuns(nextRuns);
    setWickets(nextWickets);
    setOvers(nextOvers);
    setBalls(nextBalls);

    // Update current over balls
    const ballResult = isExtra ? (extraType === 'Wide' ? 'WD' : 'NB') : run.toString();
    setCurrentOverBalls(prev => {
      // If we just finished an over (nextBalls === 0) and bowl a new ball, or if we are starting fresh
      if (balls === 0 && !isExtra && prev.length >= 6) return [ballResult];
      return [...prev, ballResult];
    });

    // Interchange logic
    let finalStriker = currentBatter;
    let finalNonStriker = nonStriker;

    // Swap on odd runs
    if (run % 2 !== 0) {
      [finalStriker, finalNonStriker] = [finalNonStriker, finalStriker];
    }

    // Swap at end of over
    if (nextBalls === 0 && nextOvers > overs && !isExtra) {
      [finalStriker, finalNonStriker] = [finalNonStriker, finalStriker];
    }

    setCurrentBatter(finalStriker);
    setNonStriker(finalNonStriker);

    // Update local stats
    if (currentBatter) {
      setPlayerStats(prev => {
        const s = prev[currentBatter.id] || { runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, runsConceded: 0, ballsBowled: 0 };
        return {
          ...prev,
          [currentBatter.id]: {
            ...s,
            runs: s.runs + run,
            balls: s.balls + (!isExtra ? 1 : 0),
            fours: s.fours + (run === 4 ? 1 : 0),
            sixes: s.sixes + (run === 6 ? 1 : 0)
          }
        };
      });
    }
    if (currentBowler) {
      setPlayerStats(prev => {
        const s = prev[currentBowler.id] || { runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, runsConceded: 0, ballsBowled: 0 };
        return {
          ...prev,
          [currentBowler.id]: {
            ...s,
            runsConceded: s.runsConceded + run + (isExtra ? 1 : 0),
            ballsBowled: s.ballsBowled + (!isExtra ? 1 : 0)
          }
        };
      });
    }

    // Save to Supabase
    const { error: insertError } = await supabase.from('balls').insert([{
      match_id: matchId,
      user_id: user.id,
      innings: match?.current_innings || 1,
      over_number: overs,
      ball_number: balls,
      runs: run,
      extra_runs: isExtra && (extraType === 'Wide' || extraType === 'No Ball') ? 1 : 0,
      extra_type: extraType,
      batter_id: currentBatter?.id,
      non_striker_id: nonStriker?.id,
      bowler_id: currentBowler?.id
    }]);

    if (insertError) {
      console.error('Error saving ball:', insertError);
    }

    await updateMatchScore(nextRuns, nextWickets, nextOvers, nextBalls, finalStriker?.id, finalNonStriker?.id, currentBowler?.id);
  };

  const addWicket = async () => {
    if (wickets < 10) {
      let nextWickets = wickets + 1;
      let nextBalls = balls;
      let nextOvers = overs;

      if (nextBalls === 5) {
        nextOvers += 1;
        nextBalls = 0;
      } else {
        nextBalls += 1;
      }

      setWickets(nextWickets);
      setBalls(nextBalls);
      setOvers(nextOvers);

      // Update current over balls
      setCurrentOverBalls(prev => {
        if (balls === 0 && prev.length >= 6) return ['W'];
        return [...prev, 'W'];
      });

      // Interchange logic for wicket
      let finalStriker = currentBatter;
      let finalNonStriker = nonStriker;

      // If it's the end of the over, the non-striker will face the next ball
      if (nextBalls === 0 && nextOvers > overs) {
        [finalStriker, finalNonStriker] = [finalNonStriker, finalStriker];
      }
      
      // Note: In a real app, we'd prompt for the new batter here.
      // For now, we keep the current batter state but the user can change it via the UI.
      setCurrentBatter(finalStriker);
      setNonStriker(finalNonStriker);

      // Update local stats for wicket
      if (currentBatter) {
        setPlayerStats(prev => {
          const s = prev[currentBatter.id] || { runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, runsConceded: 0, ballsBowled: 0 };
          return { ...prev, [currentBatter.id]: { ...s, balls: s.balls + 1 } };
        });
      }
      if (currentBowler) {
        setPlayerStats(prev => {
          const s = prev[currentBowler.id] || { runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, runsConceded: 0, ballsBowled: 0 };
          return {
            ...prev,
            [currentBowler.id]: {
              ...s,
              ballsBowled: s.ballsBowled + 1,
              wickets: s.wickets + 1
            }
          };
        });
      }

      const { error: insertError } = await supabase.from('balls').insert([{
        match_id: matchId,
        user_id: user.id,
        innings: match?.current_innings || 1,
        over_number: overs,
        ball_number: balls,
        runs: 0,
        is_wicket: true,
        batter_id: currentBatter?.id,
        non_striker_id: nonStriker?.id,
        bowler_id: currentBowler?.id
      }]);

      if (insertError) {
        console.error('Error saving wicket:', insertError);
      }

      await updateMatchScore(runs, nextWickets, nextOvers, nextBalls, currentBatter?.id, nonStriker?.id, currentBowler?.id);
    }
  };

  const undoLastBall = async () => {
    if (!match) return;
    
    try {
      // 1. Find the last ball for this match and current innings
      const { data: lastBalls, error: fetchError } = await supabase
        .from('balls')
        .select('*')
        .eq('match_id', matchId)
        .eq('innings', match.current_innings || 1)
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;
      
      if (!lastBalls || lastBalls.length === 0) {
        setStatusMessage({ text: 'No balls to undo in this innings.', type: 'info' });
        return;
      }

      // 2. Delete the last ball
      const { error: deleteError } = await supabase
        .from('balls')
        .delete()
        .eq('id', lastBalls[0].id);

      if (deleteError) throw deleteError;

      // 3. Fetch all remaining balls to recalculate the score
      const { data: remainingBalls } = await supabase
        .from('balls')
        .select('*')
        .eq('match_id', matchId)
        .eq('innings', match.current_innings || 1);

      let newRuns = 0;
      let newWickets = 0;
      let totalLegitBalls = 0;

      if (remainingBalls) {
        remainingBalls.forEach((b: any) => {
          newRuns += (b.runs || 0) + (b.extra_runs || 0);
          if (b.is_wicket) newWickets += 1;
          if (!b.extra_type || b.extra_type === 'Bye' || b.extra_type === 'Leg Bye') {
            totalLegitBalls += 1;
          }
        });
      }

      const newOvers = Math.floor(totalLegitBalls / 6);
      const newBallsInOver = totalLegitBalls % 6;

      // 4. Update match score in database
      // We also need to determine who the strikers should be. 
      // For simplicity, we'll let fetchMatch handle the striker derivation from the remaining balls.
      const scoreStr = `${newRuns}/${newWickets} (${newOvers}.${newBallsInOver})`;
      
      await supabase
        .from('matches')
        .update({ current_score: scoreStr })
        .eq('id', matchId);

      // 5. Re-fetch match to refresh UI
      await fetchMatch();
      setStatusMessage({ text: 'Last ball undone successfully.', type: 'success' });
    } catch (err: any) {
      console.error('Error undoing last ball:', err);
      setStatusMessage({ text: `Failed to undo: ${err.message}`, type: 'error' });
    }
  };

  const updateToss = async (winnerId: string, decision: string) => {
    setUpdatingToss(true);
    const { error } = await supabase
      .from('matches')
      .update({
        toss_winner_id: winnerId || null,
        toss_decision: decision || null
      })
      .eq('id', matchId)
      .or(`user_id.eq.${user.id},user_id.is.null`);

    if (error) {
      console.error('Error updating toss:', error);
    } else {
      setMatch((prev: any) => ({ ...prev, toss_winner_id: winnerId, toss_decision: decision }));
      setTossWinnerId(winnerId);
      setTossDecision(decision);
      
      // Update players based on new toss info
      if (teamAPlayers.length > 0 && teamBPlayers.length > 0) {
        const isTeamAWinner = winnerId === match.team_a_id;
        const teamABatsFirst = (isTeamAWinner && decision === 'Batting') || (!isTeamAWinner && decision === 'Bowling');
        const currentInnings = match.current_innings || 1;
        
        const battingTeam = currentInnings === 1 
          ? (teamABatsFirst ? teamAPlayers : teamBPlayers) 
          : (teamABatsFirst ? teamBPlayers : teamAPlayers);
        
        const bowlingTeam = currentInnings === 1 
          ? (teamABatsFirst ? teamBPlayers : teamAPlayers) 
          : (teamABatsFirst ? teamAPlayers : teamBPlayers);

        setCurrentBatter(battingTeam[0]);
        setNonStriker(battingTeam[1]);
        setCurrentBowler(bowlingTeam[0]);
      }
    }
    setUpdatingToss(false);
  };

  const endInnings = async () => {
    if (!match) return;
    setEndingInnings(true);
    
    const nextInnings = (match.current_innings || 1) + 1;
    
    try {
      // Save current score as innings score if needed, but for now just update current_innings
      const { error } = await supabase
        .from('matches')
        .update({ 
          current_innings: nextInnings,
          current_score: '0/0 (0.0)' 
        })
        .eq('id', matchId)
        .or(`user_id.eq.${user.id},user_id.is.null`);

      if (error) {
        console.error('Error ending innings:', error);
        setStatusMessage({ text: `Failed to end innings: ${error.message}`, type: 'error' });
      } else {
        setMatch((prev: any) => ({ ...prev, current_innings: nextInnings, current_score: '0/0 (0.0)' }));
        setRuns(0);
        setWickets(0);
        setOvers(0);
        setBalls(0);
        setCurrentOverBalls([]);
        
        // Swap players for the new innings
        if (teamAPlayers.length > 0 && teamBPlayers.length > 0 && match.toss_winner_id && match.toss_decision) {
          const isTeamAWinner = match.toss_winner_id === match.team_a_id;
          const teamABatsFirst = (isTeamAWinner && match.toss_decision === 'Batting') || (!isTeamAWinner && match.toss_decision === 'Bowling');
          
          const battingTeam = nextInnings === 1 
            ? (teamABatsFirst ? teamAPlayers : teamBPlayers) 
            : (teamABatsFirst ? teamBPlayers : teamAPlayers);
          
          const bowlingTeam = nextInnings === 1 
            ? (teamABatsFirst ? teamBPlayers : teamAPlayers) 
            : (teamABatsFirst ? teamAPlayers : teamBPlayers);

          setCurrentBatter(battingTeam[0]);
          setNonStriker(battingTeam[1]);
          setCurrentBowler(bowlingTeam[0]);
        }
        setStatusMessage({ text: 'Innings ended successfully!', type: 'success' });
      }
    } catch (err: any) {
      console.error('Unexpected error ending innings:', err);
      setStatusMessage({ text: `An unexpected error occurred: ${err.message}`, type: 'error' });
    } finally {
      setEndingInnings(false);
      setConfirmModal(null);
    }
  };

  const resetMatch = async () => {
    if (!match) {
      setStatusMessage({ text: 'Match data not loaded. Cannot reset.', type: 'error' });
      return;
    }
    
    setResettingMatch(true);
    console.log('Starting match reset for matchId:', matchId);
    
    try {
      // 1. Delete all balls for this match
      const { error: deleteError } = await supabase
        .from('balls')
        .delete()
        .eq('match_id', matchId)
        .or(`user_id.eq.${user.id},user_id.is.null`);

      if (deleteError) {
        console.error('Error deleting balls:', deleteError);
        setStatusMessage({ text: `Failed to delete match balls: ${deleteError.message}`, type: 'error' });
        setResettingMatch(false);
        return;
      }

      // 2. Reset match score and innings
      const { error: updateError } = await supabase
        .from('matches')
        .update({ 
          current_innings: 1,
          current_score: '0/0 (0.0)',
          toss_winner_id: null,
          toss_decision: null
        })
        .eq('id', matchId)
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error resetting match record:', updateError);
        setStatusMessage({ text: `Failed to reset match record: ${updateError.message}`, type: 'error' });
      } else {
        // 3. Reset local state and re-fetch to ensure everything is clean
        setRuns(0);
        setWickets(0);
        setOvers(0);
        setBalls(0);
        setTarget(null);
        setPlayerStats({});
        setCurrentOverBalls([]);
        setTossWinnerId('');
        setTossDecision('');
        
        // Re-fetch to reset players and all other derived state
        await fetchMatch();
        
        setStatusMessage({ text: 'Match has been reset successfully!', type: 'success' });
      }
    } catch (err: any) {
      console.error('Unexpected error during reset:', err);
      setStatusMessage({ text: `An unexpected error occurred: ${err.message}`, type: 'error' });
    } finally {
      setResettingMatch(false);
      setConfirmModal(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 font-medium">Loading match details...</p>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="bg-red-50 border border-red-100 p-8 rounded-3xl flex flex-col items-center text-center gap-4">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
          <AlertCircle size={32} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-red-900 mb-2">Access Denied</h3>
          <p className="text-red-700">{error || 'Match not found or you do not have permission to score this match.'}</p>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Score Header - New Theme */}
      <div className="bg-[#282878] text-white p-6 md:p-8 rounded-3xl md:rounded-[40px] shadow-2xl flex flex-col md:flex-row items-center justify-between relative overflow-hidden gap-6 md:gap-8">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full -ml-24 -mb-24 blur-2xl" />
        
        {/* Left: Batters Stats */}
        <div className="relative z-10 flex flex-col gap-3 w-full md:w-auto md:min-w-[180px] md:max-w-[220px] flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col min-w-0">
              <span className="text-xs md:text-sm font-black text-white flex items-center gap-1 truncate">
                <span className="truncate">{currentBatter?.name || 'Batter'}</span>
                <span className="text-emerald-400 flex-shrink-0">*</span>
              </span>
              <span className="text-[8px] md:text-[9px] font-bold text-[#8e8ecf] uppercase tracking-tighter">
                SR: {playerStats[currentBatter?.id]?.balls > 0 ? ((playerStats[currentBatter?.id]?.runs / playerStats[currentBatter?.id]?.balls) * 100).toFixed(1) : '0.0'}
              </span>
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-xl md:text-2xl font-black text-white">{playerStats[currentBatter?.id]?.runs || 0}</span>
              <span className="text-[10px] md:text-xs font-bold text-[#8e8ecf] ml-1">({playerStats[currentBatter?.id]?.balls || 0})</span>
            </div>
          </div>
          <div className="h-[1px] w-full bg-white/10" />
          <div className="flex items-center justify-between gap-4 opacity-60">
            <div className="flex flex-col min-w-0">
              <span className="text-xs md:text-sm font-bold text-white/80 truncate">{nonStriker?.name || 'Batter'}</span>
              <span className="text-[8px] md:text-[9px] font-bold text-[#8e8ecf] uppercase tracking-tighter">
                SR: {playerStats[nonStriker?.id]?.balls > 0 ? ((playerStats[nonStriker?.id]?.runs / playerStats[nonStriker?.id]?.balls) * 100).toFixed(1) : '0.0'}
              </span>
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-lg md:text-xl font-bold text-white/80">{playerStats[nonStriker?.id]?.runs || 0}</span>
              <span className="text-[10px] md:text-xs font-bold text-[#8e8ecf] ml-1">({playerStats[nonStriker?.id]?.balls || 0})</span>
            </div>
          </div>
        </div>

        {/* Middle: Score & Over Progress */}
        <div className="relative z-10 flex-1 flex flex-col items-center text-center min-w-0 w-full">
          <p className="text-[#8e8ecf] text-[10px] font-black uppercase tracking-[0.25em] mb-2">
            {match.team_a?.name?.substring(0, 3).toUpperCase() || 'T1'} VS {match.team_b?.name?.substring(0, 3).toUpperCase() || 'T2'}
          </p>
          <div className="flex items-baseline gap-2">
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter leading-none">{runs}/{wickets}</h1>
            <span className="text-lg md:text-xl font-bold text-[#8e8ecf]">({overs}.{balls})</span>
          </div>
          {target !== null && (
            <p className="text-emerald-400 text-[10px] md:text-xs font-black mt-2 uppercase tracking-widest">
              Target: {target} | Need {target - runs} from {((match.tournament?.overs || 20) * 6) - (overs * 6 + balls)} balls
            </p>
          )}
          <p className="text-[#8e8ecf] text-[10px] font-black tracking-widest mt-3">CRR: {((overs + balls/6) > 0 ? (runs / (overs + balls/6)) : 0).toFixed(2)}</p>
          
          {/* Ball by Ball Tracker - Middle */}
          <div className="flex gap-1.5 justify-center mt-4 flex-wrap max-w-full">
            {currentOverBalls.slice(-10).map((ball, i) => (
              <div 
                key={i} 
                className={cn(
                  "rounded-full flex items-center justify-center font-black border transition-all shadow-lg scale-110 shrink-0",
                  ball === 'W' ? "bg-rose-600 text-white border-rose-500" : 
                  ball === '4' || ball === '6' ? "bg-emerald-600 text-white border-emerald-500" :
                  ball === 'WD' || ball === 'NB' ? "bg-amber-500 text-white border-amber-400" :
                  "bg-white text-slate-950 border-slate-200",
                  currentOverBalls.slice(-10).length > 8 ? "w-5 h-5 text-[8px]" : 
                  currentOverBalls.slice(-10).length > 6 ? "w-6 h-6 text-[9px]" : 
                  "w-7 h-7 text-[10px]"
                )}
              >
                {ball}
              </div>
            ))}
            {currentOverBalls.length < 6 && [...Array(6 - currentOverBalls.length)].map((_, i) => (
              <div 
                key={`empty-${i}`} 
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black border transition-all bg-white/5 text-white/20 border-white/10 flex-shrink-0"
              />
            ))}
          </div>
        </div>

        {/* Right: Bowler Stats */}
        <div className="relative z-10 bg-white/5 backdrop-blur-md px-6 py-4 rounded-3xl border border-white/10 w-full md:w-auto md:min-w-[220px] flex-shrink-0">
          <p className="text-[10px] font-black text-[#8e8ecf] uppercase tracking-[0.3em] mb-2">BOWLING</p>
          
          <p className="text-base md:text-xl font-black text-white truncate mb-1">{currentBowler?.name || 'Select Bowler'}</p>
          
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-black text-emerald-400">
                {playerStats[currentBowler?.id]?.wickets || 0}-{playerStats[currentBowler?.id]?.runsConceded || 0}
              </span>
              <span className="text-[10px] md:text-xs font-bold text-[#8e8ecf]">
                ({Math.floor((playerStats[currentBowler?.id]?.ballsBowled || 0) / 6)}.{ (playerStats[currentBowler?.id]?.ballsBowled || 0) % 6 })
              </span>
            </div>
            <div className="text-right">
              <p className="text-[8px] md:text-[9px] font-bold text-[#8e8ecf] uppercase">ECON</p>
              <p className="text-xs md:text-sm font-black text-white">
                {playerStats[currentBowler?.id]?.ballsBowled > 0 ? ((playerStats[currentBowler?.id]?.runsConceded / (playerStats[currentBowler?.id]?.ballsBowled / 6))).toFixed(2) : '0.00'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scoring Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overlay Theme Selection */}
          <div className="bg-slate-900 p-6 rounded-3xl border border-white/10 shadow-xl overflow-hidden">
            <button 
              onClick={() => setIsThemesMinimized(!isThemesMinimized)}
              className="w-full flex items-center justify-between group"
            >
              <h3 className="text-[10px] font-black text-[#8e8ecf] uppercase tracking-[0.3em] flex items-center gap-2">
                <Zap size={14} className="text-amber-400" />
                Broadcast Overlay Themes
              </h3>
              <div className={cn(
                "p-1 rounded-lg bg-white/5 text-white/40 group-hover:bg-white/10 group-hover:text-white transition-all",
                isThemesMinimized && "rotate-180"
              )}>
                <Minus size={14} />
              </div>
            </button>
            
            {!isThemesMinimized && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="flex flex-col gap-4 mt-4"
              >
                <div className="flex flex-wrap items-center gap-2 pb-2">
                  {[
                    { id: 'emerald', name: 'Emerald', color: 'bg-emerald-500' },
                    { id: 'midnight', name: 'Midnight', color: 'bg-slate-800' },
                    { id: 'royal', name: 'Royal', color: 'bg-blue-600' },
                    { id: 'crimson', name: 'Crimson', color: 'bg-red-600' },
                    { id: 'gold', name: 'Gold', color: 'bg-amber-600' }
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTheme(t.id)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shrink-0",
                        selectedTheme === t.id 
                          ? "bg-white text-slate-900 border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]" 
                          : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
                      )}
                    >
                      <div className={cn("w-2.5 h-2.5 rounded-full", t.color)} />
                      {t.name}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <button 
                    onClick={() => window.open(`/overlay/${matchId}?theme=${selectedTheme}`, '_blank')}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-[10px] font-black text-white transition-all shadow-lg"
                  >
                    <ExternalLink size={14} />
                    OPEN OVERLAY
                  </button>
                  <button 
                    onClick={() => {
                      const url = `${window.location.origin}/overlay/${matchId}?theme=${selectedTheme}`;
                      navigator.clipboard.writeText(url);
                      setStatusMessage({ text: `${selectedTheme.toUpperCase()} overlay link copied!`, type: 'success' });
                    }}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black text-white transition-all border border-white/10"
                  >
                    <Copy size={14} />
                    COPY LINK
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <button 
              onClick={() => setIsQuickScoreMinimized(!isQuickScoreMinimized)}
              className="w-full flex items-center justify-between group"
            >
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Zap size={18} className="text-emerald-600" />
                Quick Score
              </h3>
              <div className={cn(
                "p-1.5 rounded-xl bg-slate-50 text-slate-400 group-hover:bg-emerald-50 hover:text-emerald-600 transition-all",
                isQuickScoreMinimized && "rotate-180"
              )}>
                <Minus size={16} />
              </div>
            </button>

            {!isQuickScoreMinimized && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="mt-6"
              >
                <div className="flex flex-wrap items-center gap-2 pb-2">
                  {[0, 1, 2, 3, 4, 6].map(run => (
                    <button
                      key={run}
                      onClick={() => addBall(run)}
                      className="flex-1 min-w-[48px] h-12 rounded-xl bg-slate-50 hover:bg-emerald-600 hover:text-white transition-all font-black text-lg text-slate-700 shadow-sm border border-slate-100"
                    >
                      {run}
                    </button>
                  ))}
                  <button
                    onClick={() => addBall(0, true, 'Wide')}
                    className="flex-1 min-w-[48px] h-12 rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white transition-all font-black text-sm border border-amber-100"
                  >
                    WD
                  </button>
                  <button
                    onClick={() => addBall(0, true, 'No Ball')}
                    className="flex-1 min-w-[48px] h-12 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all font-black text-sm border border-rose-100"
                  >
                    NB
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                  <button
                    onClick={addWicket}
                    className="h-12 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-all font-black text-sm shadow-lg shadow-red-200 flex items-center justify-center gap-2"
                  >
                    <AlertCircle size={18} />
                    WICKET
                  </button>
                  <button
                    onClick={undoLastBall}
                    className="h-12 rounded-xl bg-white border-2 border-slate-200 text-slate-400 hover:border-emerald-600 hover:text-emerald-600 transition-all font-black text-sm flex items-center justify-center gap-2"
                  >
                    <RotateCcw size={18} />
                    UNDO
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          {/* Extras & Others */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <button 
              onClick={() => setIsExtrasMinimized(!isExtrasMinimized)}
              className="w-full flex items-center justify-between group"
            >
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Plus size={18} className="text-emerald-600" />
                Extras & Others
              </h3>
              <div className={cn(
                "p-1.5 rounded-xl bg-slate-50 text-slate-400 group-hover:bg-emerald-50 hover:text-emerald-600 transition-all",
                isExtrasMinimized && "rotate-180"
              )}>
                <Minus size={16} />
              </div>
            </button>

            {!isExtrasMinimized && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="mt-4"
              >
                <div className="flex flex-wrap gap-3">
                  {['Bye', 'Leg Bye', 'Penalty', 'Overthrow'].map(type => (
                    <button key={type} className="px-4 py-2 rounded-xl bg-slate-50 text-slate-600 font-bold text-sm hover:bg-slate-100 transition-colors">
                      {type}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Toss Details */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <button 
              onClick={() => setIsTossMinimized(!isTossMinimized)}
              className="w-full flex items-center justify-between group"
            >
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600" />
                Toss Details
              </h3>
              <div className={cn(
                "p-1.5 rounded-xl bg-slate-50 text-slate-400 group-hover:bg-emerald-50 hover:text-emerald-600 transition-all",
                isTossMinimized && "rotate-180"
              )}>
                <Minus size={16} />
              </div>
            </button>

            {!isTossMinimized && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="mt-4 space-y-4"
              >
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Toss Winner</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => updateToss(match.team_a_id, tossDecision)}
                      className={cn(
                        "py-2 rounded-xl text-xs font-bold transition-all border",
                        tossWinnerId === match.team_a_id 
                          ? "bg-emerald-600 text-white border-emerald-600" 
                          : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100"
                      )}
                    >
                      {match.team_a?.name}
                    </button>
                    <button
                      onClick={() => updateToss(match.team_b_id, tossDecision)}
                      className={cn(
                        "py-2 rounded-xl text-xs font-bold transition-all border",
                        tossWinnerId === match.team_b_id 
                          ? "bg-emerald-600 text-white border-emerald-600" 
                          : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100"
                      )}
                    >
                      {match.team_b?.name}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Decision</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => updateToss(tossWinnerId, 'Batting')}
                      className={cn(
                        "py-2 rounded-xl text-xs font-bold transition-all border",
                        tossDecision === 'Batting' 
                          ? "bg-emerald-600 text-white border-emerald-600" 
                          : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100"
                      )}
                    >
                      Batting
                    </button>
                    <button
                      onClick={() => updateToss(tossWinnerId, 'Bowling')}
                      className={cn(
                        "py-2 rounded-xl text-xs font-bold transition-all border",
                        tossDecision === 'Bowling' 
                          ? "bg-emerald-600 text-white border-emerald-600" 
                          : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100"
                      )}
                    >
                      Bowling
                    </button>
                  </div>
                </div>
                {updatingToss && <p className="text-[10px] text-emerald-600 font-bold animate-pulse">Updating toss info...</p>}
              </motion.div>
            )}
          </div>

          {/* Innings Control */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <button 
              onClick={() => setIsInningsMinimized(!isInningsMinimized)}
              className="w-full flex items-center justify-between group"
            >
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw size={18} className="text-emerald-600" />
                Innings Control
              </h3>
              <div className={cn(
                "p-1.5 rounded-xl bg-slate-50 text-slate-400 group-hover:bg-emerald-50 hover:text-emerald-600 transition-all",
                isInningsMinimized && "rotate-180"
              )}>
                <Minus size={16} />
              </div>
            </button>

            {!isInningsMinimized && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="mt-4 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-600">Current Innings:</span>
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-black">{match.current_innings || 1}</span>
                </div>
                <button
                  onClick={() => {
                    setConfirmModal({
                      show: true,
                      title: 'End Innings',
                      message: 'Are you sure you want to end this innings? This will reset the current score for the next innings.',
                      type: 'info',
                      onConfirm: () => endInnings()
                    });
                  }}
                  disabled={endingInnings}
                  className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {endingInnings ? 'Ending Innings...' : 'End Innings'}
                </button>
                
                <button
                  onClick={() => {
                    setConfirmModal({
                      show: true,
                      title: 'CRITICAL: Reset Match',
                      message: 'This will delete ALL balls and reset the match score to zero. This action cannot be undone. Are you absolutely sure?',
                      type: 'danger',
                      onConfirm: () => resetMatch()
                    });
                  }}
                  disabled={resettingMatch}
                  className="w-full py-3 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 border border-red-100"
                >
                  <RotateCcw size={16} />
                  {resettingMatch ? 'Resetting...' : 'Reset Full Match'}
                </button>
              </motion.div>
            )}
          </div>
        </div>

        {/* Player Status */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <User size={18} className="text-emerald-600" />
                On Strike
              </h3>
              <button 
                onClick={() => {
                  const temp = currentBatter;
                  setCurrentBatter(nonStriker);
                  setNonStriker(temp);
                }}
                className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md hover:bg-emerald-100 transition-colors flex items-center gap-1"
              >
                <RotateCcw size={10} />
                SWAP
              </button>
            </div>
            <div className="space-y-4">
              <div 
                onClick={() => setShowBatterSelect(true)}
                className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 cursor-pointer hover:bg-emerald-100 transition-colors group"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-emerald-900">{currentBatter?.name || 'Select Batter'}*</span>
                    <ChevronRight size={14} className="text-emerald-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <span className="text-emerald-600 font-black">
                    {playerStats[currentBatter?.id]?.runs || 0} ({playerStats[currentBatter?.id]?.balls || 0})
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase">4s: {playerStats[currentBatter?.id]?.fours || 0}</span>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase">6s: {playerStats[currentBatter?.id]?.sixes || 0}</span>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase ml-auto">
                    SR: {playerStats[currentBatter?.id]?.balls > 0 ? ((playerStats[currentBatter?.id]?.runs / playerStats[currentBatter?.id]?.balls) * 100).toFixed(1) : '0.0'}
                  </span>
                </div>
              </div>
              <div 
                onClick={() => setShowNonStrikerSelect(true)}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors group"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700">{nonStriker?.name || 'Select Batter'}</span>
                    <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <span className="text-slate-500 font-bold">
                    {playerStats[nonStriker?.id]?.runs || 0} ({playerStats[nonStriker?.id]?.balls || 0})
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">4s: {playerStats[nonStriker?.id]?.fours || 0}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">6s: {playerStats[nonStriker?.id]?.sixes || 0}</span>
                </div>
              </div>
            </div>

            <h3 className="font-bold text-slate-900 mt-8 mb-6 flex items-center gap-2">
              <Zap size={18} className="text-emerald-600" />
              Bowling
            </h3>
            <div 
              onClick={() => setShowBowlerSelect(true)}
              className="p-4 rounded-2xl bg-slate-900 text-white cursor-pointer hover:bg-slate-800 transition-colors group"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{currentBowler?.name || 'Select Bowler'}</span>
                  <ChevronRight size={14} className="text-white/40 group-hover:translate-x-1 transition-transform" />
                </div>
                <span className="font-black text-emerald-400">
                  {Math.floor((playerStats[currentBowler?.id]?.ballsBowled || 0) / 6)}.{ (playerStats[currentBowler?.id]?.ballsBowled || 0) % 6 }
                  -{playerStats[currentBowler?.id]?.wickets || 0}
                  -{playerStats[currentBowler?.id]?.runsConceded || 0}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="text-[10px] font-bold text-white/40 uppercase">
                  ECON: {playerStats[currentBowler?.id]?.ballsBowled > 0 ? ((playerStats[currentBowler?.id]?.runsConceded / (playerStats[currentBowler?.id]?.ballsBowled / 6))).toFixed(2) : '0.00'}
                </span>
              </div>
            </div>
          </div>

          <button 
            onClick={() => {
              setConfirmModal({
                show: true,
                title: 'Finish Match',
                message: 'Are you sure you want to finish this match? This will mark the match as completed.',
                type: 'info',
                onConfirm: async () => {
                  const { error } = await supabase.from('matches').update({ status: 'Finished' }).eq('id', matchId).or(`user_id.eq.${user.id},user_id.is.null`);
                  if (error) {
                    setStatusMessage({ text: `Failed to finish match: ${error.message}`, type: 'error' });
                  } else {
                    setStatusMessage({ text: 'Match finished successfully!', type: 'success' });
                    fetchMatch();
                  }
                  setConfirmModal(null);
                }
              });
            }}
            className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={24} />
            FINISH MATCH
          </button>
        </div>
      </div>

      {/* Player Selection Modals */}
      {(showBatterSelect || showNonStrikerSelect || showBowlerSelect) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => {
              setShowBatterSelect(false);
              setShowNonStrikerSelect(false);
              setShowBowlerSelect(false);
            }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">
                  {showBowlerSelect ? 'Select Bowler' : 'Select Batter'}
                </h3>
                <button 
                  onClick={() => {
                    setShowBatterSelect(false);
                    setShowNonStrikerSelect(false);
                    setShowBowlerSelect(false);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"
                >
                  <RotateCcw size={20} />
                </button>
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {(showBowlerSelect ? getBowlingPlayers() : getBattingPlayers()).map((player) => (
                  <button
                    key={player.id}
                    onClick={async () => {
                      if (showBatterSelect) {
                        setCurrentBatter(player);
                        await updateMatchScore(runs, wickets, overs, balls, player.id, nonStriker?.id, currentBowler?.id);
                      }
                      if (showNonStrikerSelect) {
                        setNonStriker(player);
                        await updateMatchScore(runs, wickets, overs, balls, currentBatter?.id, player.id, currentBowler?.id);
                      }
                      if (showBowlerSelect) {
                        setCurrentBowler(player);
                        // Update match score cache with new bowler ID
                        await updateMatchScore(runs, wickets, overs, balls, currentBatter?.id, nonStriker?.id, player.id);
                        
                        // Clear ball tracker if we are starting a new over
                        if (balls === 0) {
                          setCurrentOverBalls([]);
                        }
                      }
                      
                      setShowBatterSelect(false);
                      setShowNonStrikerSelect(false);
                      setShowBowlerSelect(false);
                    }}
                    className={cn(
                      "w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between group",
                      (showBatterSelect && currentBatter?.id === player.id) ||
                      (showNonStrikerSelect && nonStriker?.id === player.id) ||
                      (showBowlerSelect && currentBowler?.id === player.id)
                        ? "bg-emerald-50 border-emerald-200"
                        : "bg-white border-slate-100 hover:border-emerald-100 hover:bg-slate-50"
                    )}
                  >
                    <div>
                      <p className="font-bold text-slate-900">{player.name}</p>
                      <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">{player.role || 'Player'}</p>
                    </div>
                    {(showBatterSelect && currentBatter?.id === player.id) ||
                    (showNonStrikerSelect && nonStriker?.id === player.id) ||
                    (showBowlerSelect && currentBowler?.id === player.id) ? (
                      <CheckCircle2 className="text-emerald-600" size={20} />
                    ) : (
                      <ChevronRight className="text-slate-300 group-hover:text-emerald-400 transition-colors" size={20} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal?.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden p-6"
          >
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center mb-4",
              confirmModal.type === 'danger' ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"
            )}>
              <AlertCircle size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">{confirmModal.title}</h3>
            <p className="text-slate-500 mb-6">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className={cn(
                  "flex-1 py-3 text-white font-bold rounded-xl transition-colors",
                  confirmModal.type === 'danger' ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
                )}
              >
                Confirm
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Status Message (Toast) */}
      {statusMessage && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className={cn(
            "fixed bottom-8 left-1/2 -translate-x-1/2 z-[110] px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3",
            statusMessage.type === 'success' ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
          )}
        >
          {statusMessage.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-bold">{statusMessage.text}</span>
          <button 
            onClick={() => setStatusMessage(null)}
            className="ml-4 p-1 hover:bg-white/20 rounded-lg"
          >
            <RotateCcw size={16} />
          </button>
        </motion.div>
      )}
    </div>
  );
};
