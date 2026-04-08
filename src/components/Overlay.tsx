import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

export const Overlay: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const [searchParams] = useSearchParams();
  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [playerStats, setPlayerStats] = useState<Record<string, any>>({});
  const [currentOverBalls, setCurrentOverBalls] = useState<any[]>([]);
  const [currentBatter, setCurrentBatter] = useState<any>(null);
  const [nonStriker, setNonStriker] = useState<any>(null);
  const [currentBowler, setCurrentBowler] = useState<any>(null);
  const [teamAPlayers, setTeamAPlayers] = useState<any[]>([]);
  const [teamBPlayers, setTeamBPlayers] = useState<any[]>([]);
  const [runs, setRuns] = useState(0);
  const [wickets, setWickets] = useState(0);
  const [overs, setOvers] = useState(0);
  const [balls, setBalls] = useState(0);
  const [target, setTarget] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const reconnectTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastFetchTimeRef = React.useRef<number>(Date.now());
  const ballsSubRef = React.useRef<any>(null);
  const matchSubRef = React.useRef<any>(null);
  const isFetchingRef = React.useRef<boolean>(false);

  const fetchBallsAndCalculateStats = useCallback(async (matchData?: any, playersA?: any[], playersB?: any[]) => {
    const currentMatch = matchData || match;
    const currentPlayersA = playersA || teamAPlayers;
    const currentPlayersB = playersB || teamBPlayers;
    
    if (!matchId || !currentMatch || isFetchingRef.current) return;
    
    try {
      isFetchingRef.current = true;
      const { data: ballsData, error } = await supabase
        .from('balls')
        .select('*, bowler:players!bowler_id(*), batter:players!batter_id(*), non_striker:players!non_striker_id(*)')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching balls:', error);
        setConsecutiveErrors(prev => prev + 1);
        return;
      }

      setConsecutiveErrors(0);
      lastFetchTimeRef.current = Date.now();
      
      if (ballsData && ballsData.length > 0) {
        const stats: Record<string, any> = {};
        let totalRuns = 0;
        let totalWickets = 0;
        let totalBalls = 0;
        let firstInningsRuns = 0;
        
        const currentInnings = currentMatch?.current_innings || 1;

        ballsData.forEach((ball: any) => {
          // Calculate 1st innings runs for target
          if (ball.innings === 1) {
            firstInningsRuns += (ball.runs || 0) + (ball.extra_runs || 0);
          }

          // Only process stats for current innings
          if (ball.innings === currentInnings) {
            // Batter stats
            if (ball.batter_id) {
              if (!stats[ball.batter_id]) stats[ball.batter_id] = { name: ball.batter?.name, runs: 0, balls: 0 };
              stats[ball.batter_id].runs += (ball.runs || 0);
              if (!ball.extra_type || ball.extra_type === 'No Ball') {
                stats[ball.batter_id].balls += 1;
              }
            }
            
            // Non-striker stats (ensure they exist in stats)
            if (ball.non_striker_id && !stats[ball.non_striker_id]) {
              stats[ball.non_striker_id] = { name: ball.non_striker?.name, runs: 0, balls: 0 };
            }

            // Bowler stats
            if (ball.bowler_id) {
              if (!stats[ball.bowler_id]) stats[ball.bowler_id] = { name: ball.bowler?.name, wickets: 0, runsConceded: 0, ballsBowled: 0 };
              stats[ball.bowler_id].runsConceded += (ball.runs || 0) + (ball.extra_runs || 0);
              if (!ball.extra_type || ball.extra_type === 'Bye' || ball.extra_type === 'Leg Bye') {
                stats[ball.bowler_id].ballsBowled += 1;
              }
              if (ball.is_wicket && ball.wicket_type !== 'Run-out') {
                stats[ball.bowler_id].wickets += 1;
              }
            }

            totalRuns += (ball.runs || 0) + (ball.extra_runs || 0);
            if (ball.is_wicket) totalWickets += 1;
            if (!ball.extra_type || ball.extra_type === 'Bye' || ball.extra_type === 'Leg Bye') {
              totalBalls += 1;
            }
          }
        });

        const currentInningsBalls = ballsData.filter(b => b.innings === currentInnings);
        
        // Parse current strikers from current_score if available
        let strikerIdFromScore: string | null = null;
        let nsIdFromScore: string | null = null;
        let bowlerIdFromScore: string | null = null;
        
        if (currentMatch.current_score) {
          const strikerMatch = currentMatch.current_score.match(/\|S:([^|]+)/);
          const nsMatch = currentMatch.current_score.match(/\|NS:([^|]+)/);
          const bowlerMatch = currentMatch.current_score.match(/\|B:([^|]+)/);
          if (strikerMatch) strikerIdFromScore = strikerMatch[1];
          if (nsMatch) nsIdFromScore = nsMatch[1];
          if (bowlerMatch) bowlerIdFromScore = bowlerMatch[1];
        }

        if (currentInningsBalls.length > 0) {
          const lastBall = currentInningsBalls[currentInningsBalls.length - 1];
          let currentStriker = lastBall.batter;
          let currentNonStriker = lastBall.non_striker;

          // Rotate strike if runs were odd
          if ((lastBall.runs || 0) % 2 !== 0) {
            [currentStriker, currentNonStriker] = [currentNonStriker, currentStriker];
          }

          // Rotate strike if over ended (and it wasn't an extra that doesn't count as a ball)
          const isExtraThatDoesntCount = lastBall.extra_type === 'Wide' || lastBall.extra_type === 'No Ball';
          if (totalBalls % 6 === 0 && !isExtraThatDoesntCount) {
            [currentStriker, currentNonStriker] = [currentNonStriker, currentStriker];
          }

          // Override with IDs from score if they exist (helps with synchronization during wicket/selection)
          if (strikerIdFromScore) {
            const foundStriker = [...currentPlayersA, ...currentPlayersB].find(p => p.id === strikerIdFromScore);
            if (foundStriker) currentStriker = foundStriker;
          }
          if (nsIdFromScore) {
            const foundNS = [...currentPlayersA, ...currentPlayersB].find(p => p.id === nsIdFromScore);
            if (foundNS) currentNonStriker = foundNS;
          }

          setCurrentBatter(currentStriker);
          setNonStriker(currentNonStriker);
          
          let currentBowler = lastBall.bowler;
          if (bowlerIdFromScore) {
            const foundBowler = [...currentPlayersA, ...currentPlayersB].find(p => p.id === bowlerIdFromScore);
            if (foundBowler) currentBowler = foundBowler;
          }
          setCurrentBowler(currentBowler);
        } else if (currentPlayersA.length > 0 && currentPlayersB.length > 0) {
          // No balls in current innings yet, determine initial players
          const isTeamAWinner = currentMatch.toss_winner_id === currentMatch.team_a_id;
          const teamABatsFirst = (isTeamAWinner && currentMatch.toss_decision === 'Batting') || (!isTeamAWinner && currentMatch.toss_decision === 'Bowling');
          
          const battingTeam = currentInnings === 1 
            ? (teamABatsFirst ? currentPlayersA : currentPlayersB) 
            : (teamABatsFirst ? currentPlayersB : currentPlayersA);
          
          const bowlingTeam = currentInnings === 1 
            ? (teamABatsFirst ? currentPlayersB : currentPlayersA) 
            : (teamABatsFirst ? currentPlayersA : currentPlayersB);

          // Still check for IDs from score even if no balls yet
          let s = battingTeam[0];
          let ns = battingTeam[1];
          let b = bowlingTeam[0];
          
          if (strikerIdFromScore) {
            const foundStriker = [...currentPlayersA, ...currentPlayersB].find(p => p.id === strikerIdFromScore);
            if (foundStriker) s = foundStriker;
          }
          if (nsIdFromScore) {
            const foundNS = [...currentPlayersA, ...currentPlayersB].find(p => p.id === nsIdFromScore);
            if (foundNS) ns = foundNS;
          }
          if (bowlerIdFromScore) {
            const foundBowler = [...currentPlayersA, ...currentPlayersB].find(p => p.id === bowlerIdFromScore);
            if (foundBowler) b = foundBowler;
          }

          setCurrentBatter(s);
          setNonStriker(ns);
          setCurrentBowler(b);
        }

        setRuns(totalRuns);
        setWickets(totalWickets);
        setOvers(Math.floor(totalBalls / 6));
        setBalls(totalBalls % 6);
        setPlayerStats(stats);
        
        if (currentInnings === 2) {
          setTarget(firstInningsRuns + 1);
        } else {
          setTarget(null);
        }

        // Calculate current over balls
        const currentTotalBalls = totalBalls;
        let displayOverNum = Math.floor(currentTotalBalls / 6);
        
        // Only show balls for the current over
        let currentOverBallsData = currentInningsBalls.filter(b => b.over_number === displayOverNum);
        
        // Fallback: If current over is empty, show previous over's balls 
        // BUT only if the bowler hasn't changed yet (still showing previous bowler's stats)
        if (currentOverBallsData.length === 0 && displayOverNum > 0) {
          const lastBall = currentInningsBalls[currentInningsBalls.length - 1];
          const isNewBowlerSelected = bowlerIdFromScore && lastBall && bowlerIdFromScore !== lastBall.bowler_id;
          
          if (!isNewBowlerSelected) {
            const prevOverBalls = currentInningsBalls.filter(b => b.over_number === displayOverNum - 1);
            if (prevOverBalls.length > 0) {
              currentOverBallsData = prevOverBalls;
            }
          }
        }

        setCurrentOverBalls(currentOverBallsData
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .map(b => {
            if (b.is_wicket) return 'W';
            if (b.extra_type === 'Wide') return 'WD';
            if (b.extra_type === 'No Ball') return 'NB';
            if (b.extra_type) return b.extra_type.substring(0, 1).toUpperCase();
            return b.runs.toString();
          })
        );
      } else if (currentMatch && currentPlayersA.length > 0 && currentPlayersB.length > 0) {
        // Set initial players if no balls found (start of match)
        const isTeamAWinner = currentMatch.toss_winner_id === currentMatch.team_a_id;
        const teamABatsFirst = (isTeamAWinner && currentMatch.toss_decision === 'Batting') || (!isTeamAWinner && currentMatch.toss_decision === 'Bowling');
        const currentInnings = currentMatch.current_innings || 1;
        
        const battingTeam = currentInnings === 1 
          ? (teamABatsFirst ? currentPlayersA : currentPlayersB) 
          : (teamABatsFirst ? currentPlayersB : currentPlayersA);
        
        const bowlingTeam = currentInnings === 1 
          ? (teamABatsFirst ? currentPlayersB : currentPlayersA) 
          : (teamABatsFirst ? currentPlayersA : currentPlayersB);

        setCurrentBatter(battingTeam[0]);
        setNonStriker(battingTeam[1]);
        setCurrentBowler(bowlingTeam[0]);
        
        setRuns(0);
        setWickets(0);
        setOvers(0);
        setBalls(0);
        setPlayerStats({});
        setCurrentOverBalls([]);
      } else {
        // Reset stats if no balls found and no player data yet
        setRuns(0);
        setWickets(0);
        setOvers(0);
        setBalls(0);
        setPlayerStats({});
        setCurrentOverBalls([]);
      }
    } catch (err) {
      console.error('Unexpected error in fetchBallsAndCalculateStats:', err);
      setConsecutiveErrors(prev => prev + 1);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [matchId, match, teamAPlayers, teamBPlayers]);

  const fetchInitialData = useCallback(async () => {
    if (!matchId) {
      setError('No match ID provided');
      setLoading(false);
      return;
    }

    const url = import.meta.env.VITE_SUPABASE_URL;
    if (!url || url === 'https://placeholder.supabase.co') {
      setError('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the Settings menu.');
      setLoading(false);
      return;
    }

    try {
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select('*, team_a:teams!team_a_id(*), team_b:teams!team_b_id(*), tournament:tournaments(*)')
        .eq('id', matchId)
        .single();

      if (matchError) {
        console.error('Error fetching match:', matchError);
        // Only set hard error if we don't have existing data
        if (!match) {
          setError(`Match not found: ${matchError.message}`);
        }
        setConsecutiveErrors(prev => prev + 1);
        setLoading(false);
        return;
      }

      if (!matchData) {
        if (!match) setError('Match not found');
        setLoading(false);
        return;
      }

      setMatch(matchData);
      setConsecutiveErrors(0);
      setError(null);
      
      // Fetch players for both teams
      const { data: pA } = await supabase.from('players').select('*').eq('team_id', matchData.team_a_id);
      const { data: pB } = await supabase.from('players').select('*').eq('team_id', matchData.team_b_id);
      
      if (pA) setTeamAPlayers(pA);
      if (pB) setTeamBPlayers(pB);

      await fetchBallsAndCalculateStats(matchData, pA || [], pB || []);
    } catch (err: any) {
      console.error('Unexpected error:', err);
      if (!match) setError(`An unexpected error occurred: ${err.message}`);
      setConsecutiveErrors(prev => prev + 1);
      setLoading(false);
    }
  }, [matchId, fetchBallsAndCalculateStats]);

  useEffect(() => {
    let pollingInterval: any;

    const setupSubscriptions = () => {
      if (!matchId) return;

      // Clear any existing reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Cleanup existing subscriptions before recreating
      if (ballsSubRef.current) {
        supabase.removeChannel(ballsSubRef.current);
        ballsSubRef.current = null;
      }
      if (matchSubRef.current) {
        supabase.removeChannel(matchSubRef.current);
        matchSubRef.current = null;
      }

      // Real-time updates for balls
      ballsSubRef.current = supabase
        .channel(`balls_${matchId}`)
        .on('postgres_changes', { 
          event: '*', 
          table: 'balls', 
          schema: 'public', 
          filter: `match_id=eq.${matchId}` 
        }, (payload) => {
          console.log('Balls change detected:', payload);
          fetchBallsAndCalculateStats();
        })
        .subscribe((status) => {
          console.log(`Balls subscription status: ${status}`);
          if (status === 'SUBSCRIBED') {
            setIsRealtimeConnected(true);
            setConsecutiveErrors(0);
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setIsRealtimeConnected(false);
            console.log(`Subscription issue (${status}), attempting reconnect...`);
            // Try to reconnect after 3 seconds
            if (!reconnectTimeoutRef.current) {
              reconnectTimeoutRef.current = setTimeout(() => {
                reconnectTimeoutRef.current = null;
                setupSubscriptions();
              }, 3000);
            }
          }
        });

      // Real-time updates for match
      matchSubRef.current = supabase
        .channel(`match_${matchId}`)
        .on('postgres_changes', { 
          event: 'UPDATE', 
          table: 'matches', 
          schema: 'public', 
          filter: `id=eq.${matchId}` 
        }, (payload) => {
          console.log('Match change detected:', payload);
          fetchInitialData();
        })
        .subscribe((status) => {
          console.log(`Match subscription status: ${status}`);
        });
    };

    fetchInitialData();
    setupSubscriptions();

    // Polling backup (every 1 second for ultra-fast sync)
    pollingInterval = setInterval(() => {
      fetchBallsAndCalculateStats();
      // Occasionally refresh match data too (every 5 seconds)
      if (Math.random() > 0.8) {
        fetchInitialData();
      }
    }, 1000);

    return () => {
      if (ballsSubRef.current) supabase.removeChannel(ballsSubRef.current);
      if (matchSubRef.current) supabase.removeChannel(matchSubRef.current);
      if (pollingInterval) clearInterval(pollingInterval);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [matchId, fetchInitialData, fetchBallsAndCalculateStats]);

  if (!match) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm">
        <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="font-bold text-slate-800">Connecting to Scoreboard...</p>
        </div>
      </div>
    );
  }

  const batter1 = playerStats[currentBatter?.id] || { name: currentBatter?.name || 'Batter', runs: 0, balls: 0 };
  const batter2 = playerStats[nonStriker?.id] || { name: nonStriker?.name || 'Batter', runs: 0, balls: 0 };
  const bowler = playerStats[currentBowler?.id] || { name: currentBowler?.name || 'Bowler', wickets: 0, runsConceded: 0, ballsBowled: 0 };

  const getInitials = (name: string) => {
    if (!name) return '';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 3);
  };

  const isTeamAWinner = match.toss_winner_id === match.team_a_id;
  const teamABatsFirst = (isTeamAWinner && match.toss_decision === 'Batting') || (!isTeamAWinner && match.toss_decision === 'Bowling');
  const currentInnings = match.current_innings || 1;
  
  const battingTeam = currentInnings === 1 
    ? (teamABatsFirst ? match.team_a : match.team_b) 
    : (teamABatsFirst ? match.team_b : match.team_a);
  
  const bowlingTeam = currentInnings === 1 
    ? (teamABatsFirst ? match.team_b : match.team_a) 
    : (teamABatsFirst ? match.team_a : match.team_b);

  const themeParam = searchParams.get('theme') || 'emerald';
  
  const themes: Record<string, any> = {
    emerald: {
      bar: "from-[#064e3b] via-[#065f46] to-[#064e3b]",
      tab: "bg-emerald-500",
      accent: "text-emerald-600",
      emptyBall: "bg-emerald-50/50 text-emerald-200 border-emerald-100/50"
    },
    midnight: {
      bar: "from-[#0f172a] via-[#1e293b] to-[#0f172a]",
      tab: "bg-slate-700",
      accent: "text-slate-600",
      emptyBall: "bg-slate-800/50 text-slate-500 border-slate-700/50"
    },
    royal: {
      bar: "from-[#1e3a8a] via-[#2563eb] to-[#1e3a8a]",
      tab: "bg-blue-600",
      accent: "text-blue-600",
      emptyBall: "bg-blue-50/50 text-blue-200 border-blue-100/50"
    },
    crimson: {
      bar: "from-[#7f1d1d] via-[#b91c1c] to-[#7f1d1d]",
      tab: "bg-red-600",
      accent: "text-red-600",
      emptyBall: "bg-red-50/50 text-red-200 border-red-100/50"
    },
    gold: {
      bar: "from-[#713f12] via-[#a16207] to-[#713f12]",
      tab: "bg-amber-600",
      accent: "text-amber-600",
      emptyBall: "bg-amber-50/50 text-amber-200 border-amber-100/50"
    }
  };

  const currentTheme = themes[themeParam] || themes.emerald;

  return (
    <>
      {/* Real-time Connection Status Indicator */}
      <div className="fixed top-4 right-4 z-[100] flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 shadow-lg pointer-events-none">
        <div className={cn(
          "w-2 h-2 rounded-full animate-pulse",
          isRealtimeConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
        )} />
        <span className="text-[10px] font-black text-white/80 uppercase tracking-widest">
          {isRealtimeConnected ? "Real-time Sync Active" : "Syncing (Polling Mode)"}
        </span>
      </div>

      <div className={cn(
        "fixed bottom-10 left-1/2 -translate-x-1/2 w-[95%] max-w-[1200px] h-[110px] bg-gradient-to-r border-y-2 border-white/20 flex items-center shadow-2xl overflow-hidden rounded-xl backdrop-blur-md",
        currentTheme.bar
      )}>
      {/* Background Pattern Overlay */}
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-cricket-pattern" />
      
      {/* Branding Tab */}
      <div className={cn(
        "absolute top-0 left-1/2 -translate-x-1/2 px-4 py-0.5 text-white text-[8px] font-black tracking-[0.4em] rounded-b-md shadow-sm z-50",
        currentTheme.tab
      )}>
        GROUND SCORE
      </div>
      {/* Left: Batting Team Logo & Batters */}
      <div className="flex items-center h-full px-4 gap-4 border-r border-white/10 flex-1 min-w-0">
        <div className="w-14 h-14 sm:w-18 sm:h-18 bg-white/10 rounded-lg flex items-center justify-center p-2 shadow-inner border border-white/5 shrink-0">
          {battingTeam?.logo_url ? (
            <img src={battingTeam.logo_url} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
          ) : (
            <div className="text-white font-black text-2xl">{getInitials(battingTeam?.name)}</div>
          )}
        </div>
        <div className="flex flex-col justify-center min-w-[220px]">
          <div className="flex items-center justify-between gap-4">
            <span className="text-white font-black text-xl uppercase flex items-center gap-2 tracking-tight">
              <Zap size={16} className="text-yellow-400 fill-yellow-400" />
              {batter1.name}
            </span>
            <span className="text-white font-black text-2xl">
              {batter1.runs} <span className="text-white/60 text-sm font-bold">({batter1.balls})</span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 opacity-60">
            <span className="text-white font-bold text-lg uppercase tracking-tight">{batter2.name}</span>
            <span className="text-white font-bold text-xl">
              {batter2.runs} <span className="text-white/60 text-xs font-bold">({batter2.balls})</span>
            </span>
          </div>
        </div>
      </div>

      {/* Middle: Score Box (White Box like image) */}
      <div className="h-full flex items-center justify-center px-2 z-10 flex-[0_1_450px] min-w-0">
        <div className="bg-white rounded-xl shadow-2xl w-full h-[95px] flex flex-col items-center overflow-hidden border-2 border-slate-200">
          <div className="flex-1 flex flex-col items-center justify-center w-full px-4 sm:px-6 gap-1">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-slate-100 rounded flex items-center justify-center overflow-hidden border border-slate-200">
                  {match.team_b?.logo_url ? (
                    <img src={match.team_b.logo_url} alt="B" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-[8px] font-black text-slate-400">{getInitials(match.team_b?.name)}</span>
                  )}
                </div>
                <span className="text-slate-900 font-black text-base uppercase tracking-tighter">
                  {match.team_b?.short_name || match.team_b?.name?.substring(0, 3)}
                </span>
                <span className="text-slate-400 font-bold text-xs mx-1">Vs</span>
                <span className="text-slate-900 font-black text-base uppercase tracking-tighter">
                  {match.team_a?.short_name || match.team_a?.name?.substring(0, 3)}
                </span>
                <div className="w-5 h-5 bg-slate-100 rounded flex items-center justify-center overflow-hidden border border-slate-200">
                  {match.team_a?.logo_url ? (
                    <img src={match.team_a.logo_url} alt="A" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-[8px] font-black text-slate-400">{getInitials(match.team_a?.name)}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-slate-900 font-black text-3xl tracking-tighter leading-none">{runs}-{wickets}</span>
                <span className="text-slate-900 font-black text-xs uppercase whitespace-nowrap opacity-60">{overs} OVER</span>
              </div>
            </div>
            
            {/* Ball Tracker Row */}
            <div className="flex gap-2 py-1">
              {currentOverBalls.slice(-10).map((ball, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "rounded-full flex items-center justify-center font-black border transition-all shadow-md shrink-0",
                    ball === 'W' ? "bg-rose-600 text-white border-rose-500" : 
                    ball === '4' || ball === '6' ? "bg-emerald-600 text-white border-emerald-500" :
                    ball === 'WD' || ball === 'NB' ? "bg-amber-500 text-white border-amber-400" :
                    "bg-white text-slate-950 border-slate-300",
                    currentOverBalls.slice(-10).length > 8 ? "w-4 h-4 text-[7px]" : 
                    currentOverBalls.slice(-10).length > 6 ? "w-5 h-5 text-[8px]" : 
                    "w-7 h-7 text-[10px]"
                  )}
                >
                  {ball}
                </div>
              ))}
              {currentOverBalls.length < 6 && [...Array(6 - currentOverBalls.length)].map((_, i) => (
                <div 
                  key={`empty-${i}`} 
                  className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black border transition-all flex-shrink-0", currentTheme.emptyBall)}
                />
              ))}
            </div>
          </div>
          
          <div className="w-full h-[22px] bg-slate-100 flex items-center justify-center border-t border-slate-200">
            <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
              {target !== null ? (
                <div className="flex items-center gap-4">
                  <span className={cn("font-black", currentTheme.accent)}>TARGET: {target}</span>
                  <span className="text-slate-400">|</span>
                  <span>NEED {target - runs} FROM {((match.tournament?.overs || 20) * 6) - (overs * 6 + balls)} BALLS</span>
                </div>
              ) : match.toss_winner_id ? (
                <>
                  {match.toss_winner_id === match.team_a_id ? match.team_a?.name : match.team_b?.name} WON THE TOSS AND CHOSE TO {match.toss_decision?.toUpperCase() || 'BAT'}
                </>
              ) : (
                <>TOSS DETAILS PENDING</>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Bowler Info */}
      <div className="flex items-center h-full px-4 gap-4 border-l border-white/10 flex-1 justify-end min-w-0 pr-4 sm:pr-12">
        <div className="flex flex-col justify-center items-end max-w-full overflow-hidden">
          <div className="flex items-center justify-between w-full gap-2 sm:gap-4">
            <span className="text-white font-black text-xl uppercase tracking-tight truncate max-w-[150px]">{bowler.name}</span>
            <span className="text-white font-black text-2xl whitespace-nowrap">
              {bowler.wickets}-{bowler.runsConceded}
              <span className="text-white/60 text-sm font-bold ml-2">
                ({Math.floor(bowler.ballsBowled / 6)}.{bowler.ballsBowled % 6})
              </span>
            </span>
          </div>
        </div>
        <div className="w-14 h-14 sm:w-18 sm:h-18 bg-white/10 rounded-full flex items-center justify-center p-2 border-2 border-white/20 shadow-lg shrink-0">
          {bowlingTeam?.logo_url ? (
            <img src={bowlingTeam.logo_url} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
          ) : (
            <div className="text-white font-black text-2xl">{getInitials(bowlingTeam?.name)}</div>
          )}
        </div>
      </div>
    </div>
  </>
  );
};
