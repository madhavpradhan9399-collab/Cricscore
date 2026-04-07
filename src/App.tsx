import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Users, 
  Calendar, 
  Tv, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  ChevronRight,
  Plus,
  Search,
  LayoutDashboard,
  Play,
  AlertCircle,
  CheckCircle,
  Info,
  Trash2,
  RotateCcw,
  ExternalLink,
  WifiOff,
  Upload,
  Image as ImageIcon,
  Loader2
} from 'lucide-react';
import { supabase } from './lib/supabase';
import { cn } from './lib/utils';
import { ScoringPanel } from './components/ScoringPanel';
import { Overlay } from './components/Overlay';

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active?: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center w-full gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
      active 
        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200/50" 
        : "text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
    )}
  >
    <Icon size={20} className={cn(active ? "text-white" : "text-slate-400 group-hover:text-indigo-600")} />
    <span className="font-medium">{label}</span>
    {active && (
      <motion.div 
        layoutId="active-pill"
        className="ml-auto w-1.5 h-1.5 rounded-full bg-white"
      />
    )}
  </button>
);

const Card = ({ children, className, ...props }: { children: React.ReactNode, className?: string, [key: string]: any }) => (
  <div className={cn("bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden", className)} {...props}>
    {children}
  </div>
);

// --- Main App ---

export default function App() {
  useEffect(() => {
    const handlePathChange = () => {
      if (window.location.pathname.startsWith('/overlay')) {
        document.body.style.backgroundColor = 'transparent';
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.backgroundColor = '';
        document.body.style.margin = '';
        document.body.style.padding = '';
        document.body.style.overflow = '';
      }
    };

    handlePathChange();
    
    // Listen for popstate to handle back/forward navigation
    window.addEventListener('popstate', handlePathChange);
    return () => window.removeEventListener('popstate', handlePathChange);
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/overlay/:matchId" element={<Overlay />} />
        <Route path="*" element={<MainApp />} />
      </Routes>
    </Router>
  );
}

function MainApp() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [tournaments, setTournaments] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [selectedTeamForPlayers, setSelectedTeamForPlayers] = useState<any | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Tournament Form State
  const [showNewTournamentModal, setShowNewTournamentModal] = useState(false);
  const [newTournament, setNewTournament] = useState({
    name: '',
    location: '',
    format: 'T20',
    overs: 20,
    start_date: '',
    end_date: ''
  });

  // Team Form State
  const [showNewTeamModal, setShowNewTeamModal] = useState(false);
  const [newTeam, setNewTeam] = useState({
    name: '',
    tournament_id: '',
    logo_url: ''
  });

  // Match Form State
  const [showNewMatchModal, setShowNewMatchModal] = useState(false);
  const [newMatch, setNewMatch] = useState({
    tournament_id: '',
    team_a_id: '',
    team_b_id: '',
    status: 'Upcoming'
  });

  // Player Form State
  const [showNewPlayerModal, setShowNewPlayerModal] = useState(false);
  const [newPlayer, setNewPlayer] = useState({
    name: '',
    team_id: '',
    role: 'Batsman'
  });

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'info';
  } | null>(null);

  // Status Message State
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Try to get the session from local storage first
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          // If there's an error, we still want to stop loading to show the login page
          setLoading(false);
          return;
        }

        if (session?.user) {
          setUser(session.user);
          fetchTournaments(3, session.user);
          fetchMatches(3, session.user);
          fetchTeams(3, session.user);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        // Small delay to ensure state has propagated
        setTimeout(() => setLoading(false), 500);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          fetchTournaments(3, currentUser);
          fetchMatches(3, currentUser);
          fetchTeams(3, currentUser);
        }
      } else {
        setTournaments([]);
        setMatches([]);
        setTeams([]);
      }
    });

    // Real-time listener for matches
    const matchesSubscription = supabase
      .channel('matches_changes')
      .on('postgres_changes', { event: '*', table: 'matches', schema: 'public' }, () => {
        fetchMatches();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(matchesSubscription);
    };
  }, []);

  const fetchTeams = async (retries = 3, currentUser = user) => {
    const url = (import.meta as any).env.VITE_SUPABASE_URL;
    if (!url || url === 'https://placeholder.supabase.co' || !currentUser) return;

    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*, tournament:tournaments(name), players(*)')
        .or(`user_id.eq.${currentUser.id},user_id.is.null`);
      
      if (error) {
        console.error('Error fetching teams:', error);
        if (retries > 0) {
          console.log(`Retrying fetchTeams... (${retries} retries left)`);
          setTimeout(() => fetchTeams(retries - 1), 2000);
        }
      } else if (data) {
        setTeams(data);
      }
    } catch (err: any) {
      console.error('Failed to fetch teams:', err);
      if (retries > 0) {
        console.log(`Retrying fetchTeams after exception... (${retries} retries left)`);
        setTimeout(() => fetchTeams(retries - 1), 2000);
      } else {
        setSupabaseError(`Network error: ${err.message}. Please check your connection.`);
      }
    }
  };

  const fetchTournaments = async (retries = 3, currentUser = user) => {
    const url = (import.meta as any).env.VITE_SUPABASE_URL;
    if (!url || url === 'https://placeholder.supabase.co' || !currentUser) {
      if (!url || url === 'https://placeholder.supabase.co') {
        setSupabaseError('Supabase URL is missing or set to placeholder. Please configure it in Settings.');
      }
      return;
    }

    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .or(`user_id.eq.${currentUser.id},user_id.is.null`)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching tournaments:', error);
        if (retries > 0) {
          setTimeout(() => fetchTournaments(retries - 1), 2000);
        } else {
          setSupabaseError(error.message);
        }
      } else if (data) {
        setTournaments(data);
        setSupabaseError(null);
      }
    } catch (err: any) {
      console.error('Network error fetching tournaments:', err);
      if (retries > 0) {
        setTimeout(() => fetchTournaments(retries - 1), 2000);
      } else {
        setSupabaseError(err.message || 'Failed to connect to Supabase. Check your network and Supabase URL.');
      }
    }
  };

  const fetchMatches = async (retries = 3, currentUser = user) => {
    const url = (import.meta as any).env.VITE_SUPABASE_URL;
    if (!url || url === 'https://placeholder.supabase.co' || !currentUser) return;

    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*, team_a:teams!team_a_id(name), team_b:teams!team_b_id(name)')
        .or(`user_id.eq.${currentUser.id},user_id.is.null`)
        .order('date_time', { ascending: false });
      
      if (error) {
        console.error('Error fetching matches:', error);
        if (retries > 0) {
          setTimeout(() => fetchMatches(retries - 1), 2000);
        } else {
          setSupabaseError(error.message);
        }
      } else if (data) {
        setMatches(data);
        setSupabaseError(null);
      }
    } catch (err: any) {
      console.error('Network error fetching matches:', err);
      if (retries > 0) {
        setTimeout(() => fetchMatches(retries - 1), 2000);
      } else {
        setSupabaseError(err.message || 'Failed to connect to Supabase. Check your network and Supabase URL.');
      }
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);

    try {
      if (isForgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setStatusMessage({ text: 'Password reset link sent to your email!', type: 'success' });
        setIsForgotPassword(false);
      } else if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setStatusMessage({ text: 'Check your email for the confirmation link!', type: 'success' });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Check file size (limit to 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setStatusMessage({ text: 'File size too large. Please upload an image smaller than 2MB.', type: 'error' });
      return;
    }

    setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath);

      setNewTeam({ ...newTeam, logo_url: publicUrl });
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      if (error.message === 'Bucket not found') {
        setStatusMessage({ 
          text: '❌ ERROR: Storage bucket "logos" was not found. Please create it in Supabase Dashboard.', 
          type: 'error' 
        });
      } else {
        setStatusMessage({ text: `Upload failed: ${error.message}. Make sure the 'logos' bucket exists and is public.`, type: 'error' });
      }
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('teams').insert([{ ...newTeam, user_id: user.id }]);
      if (error) throw error;
      setShowNewTeamModal(false);
      setNewTeam({ name: '', tournament_id: '', logo_url: '' });
      fetchTeams();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('matches').insert([{ ...newMatch, user_id: user.id }]);
      if (error) throw error;
      setShowNewMatchModal(false);
      setNewMatch({ tournament_id: '', team_a_id: '', team_b_id: '', status: 'Upcoming' });
      fetchMatches();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('players').insert([{ ...newPlayer, user_id: user.id }]);
      if (error) throw error;
      setShowNewPlayerModal(false);
      setNewPlayer({ name: '', team_id: '', role: 'Batsman' });
      setStatusMessage({ text: 'Player added successfully!', type: 'success' });
    } catch (error: any) {
      setStatusMessage({ text: error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setActiveTab('dashboard');
  };

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setStatusMessage({ text: 'You must be logged in to create a tournament.', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      // Clean up data: convert empty strings to null for optional fields
      const tournamentData = {
        name: newTournament.name.trim(),
        location: newTournament.location.trim() || null,
        format: newTournament.format,
        overs: isNaN(newTournament.overs) ? 20 : newTournament.overs,
        start_date: newTournament.start_date || null,
        end_date: newTournament.end_date || null,
        user_id: user.id
      };

      if (!tournamentData.name) {
        throw new Error('Tournament name is required');
      }

      const { error } = await supabase
        .from('tournaments')
        .insert([tournamentData]);
      
      if (error) throw error;
      
      setShowNewTournamentModal(false);
      setNewTournament({
        name: '',
        location: '',
        format: 'T20',
        overs: 20,
        start_date: '',
        end_date: ''
      });
      await fetchTournaments();
    } catch (error: any) {
      console.error('Error creating tournament:', error);
      setStatusMessage({ text: error.message || 'Failed to create tournament', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTournament = async (id: string) => {
    if (!user) return;
    
    setConfirmModal({
      show: true,
      title: 'Delete Tournament',
      message: 'Are you sure you want to delete this tournament? All teams, matches, and scoring data will be permanently lost.',
      type: 'danger',
      onConfirm: async () => {
        setLoading(true);
        try {
          // 1. Get all matches for this tournament to delete their balls
          const { data: tournamentMatches, error: matchesFetchError } = await supabase
            .from('matches')
            .select('id')
            .eq('tournament_id', id);
          
          if (matchesFetchError) throw matchesFetchError;
          
          if (tournamentMatches && tournamentMatches.length > 0) {
            const matchIds = tournamentMatches.map(m => m.id);
            // Delete balls for all matches in this tournament
            const { error: ballsDeleteError } = await supabase.from('balls').delete().in('match_id', matchIds).or(`user_id.eq.${user.id},user_id.is.null`);
            if (ballsDeleteError) throw ballsDeleteError;

            // Delete matches
            const { error: matchesDeleteError } = await supabase.from('matches').delete().eq('tournament_id', id).or(`user_id.eq.${user.id},user_id.is.null`);
            if (matchesDeleteError) throw matchesDeleteError;
          }

          // 2. Get all teams for this tournament to delete their players
          const { data: tournamentTeams, error: teamsFetchError } = await supabase
            .from('teams')
            .select('id')
            .eq('tournament_id', id);
          
          if (teamsFetchError) throw teamsFetchError;
          
          if (tournamentTeams && tournamentTeams.length > 0) {
            const teamIds = tournamentTeams.map(t => t.id);
            // Delete players for all teams in this tournament
            const { error: playersDeleteError } = await supabase.from('players').delete().in('team_id', teamIds).or(`user_id.eq.${user.id},user_id.is.null`);
            if (playersDeleteError) throw playersDeleteError;

            // Delete teams
            const { error: teamsDeleteError } = await supabase.from('teams').delete().eq('tournament_id', id).or(`user_id.eq.${user.id},user_id.is.null`);
            if (teamsDeleteError) throw teamsDeleteError;
          }

          // 3. Finally delete the tournament
          const { error: tournamentDeleteError } = await supabase
            .from('tournaments')
            .delete()
            .eq('id', id)
            .or(`user_id.eq.${user.id},user_id.is.null`);
          
          if (tournamentDeleteError) throw tournamentDeleteError;
          
          fetchTournaments(3, user);
          fetchMatches(3, user);
          fetchTeams(3, user);
          setStatusMessage({ text: 'Tournament deleted successfully', type: 'success' });
        } catch (error: any) {
          console.error('Error deleting tournament:', error);
          setStatusMessage({ text: `Failed to delete tournament: ${error.message}`, type: 'error' });
        } finally {
          setLoading(false);
          setConfirmModal(null);
        }
      }
    });
  };
;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  // Auth Guard
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Trophy size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 text-center mb-2">CricOverlay</h1>
          <p className="text-slate-500 text-center mb-8">
            {isForgotPassword ? 'Reset your password' : (isSignUp ? 'Create your account' : 'Sign in to your account')}
          </p>
          
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                placeholder="you@example.com"
              />
            </div>
            {!isForgotPassword && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">Password</label>
                  {!isSignUp && (
                    <button 
                      type="button"
                      onClick={() => setIsForgotPassword(true)}
                      className="text-xs text-indigo-600 hover:underline font-medium"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            )}

            {authError && (
              <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{authError}</p>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Processing...' : (isForgotPassword ? 'Send Reset Link' : (isSignUp ? 'Sign Up' : 'Sign In'))}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            {isForgotPassword ? (
              <button 
                onClick={() => setIsForgotPassword(false)}
                className="text-sm text-indigo-600 font-medium hover:underline block w-full"
              >
                Back to Sign In
              </button>
            ) : (
              <button 
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-indigo-600 font-medium hover:underline block w-full"
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
            )}
          </div>
          
          <p className="mt-8 text-xs text-slate-400 text-center">
            By continuing, you agree to our Terms of Service
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        className="bg-white border-r border-slate-100 flex flex-col sticky top-0 h-screen z-20"
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-200">
            <Trophy size={24} />
          </div>
          {isSidebarOpen && (
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-bold text-xl text-slate-900 tracking-tight"
            >
              CricOverlay
            </motion.span>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          <SidebarItem 
            icon={LayoutDashboard} 
            label={isSidebarOpen ? "Dashboard" : ""} 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <SidebarItem 
            icon={Trophy} 
            label={isSidebarOpen ? "Tournaments" : ""} 
            active={activeTab === 'tournaments'} 
            onClick={() => setActiveTab('tournaments')} 
          />
          <SidebarItem 
            icon={Users} 
            label={isSidebarOpen ? "Teams" : ""} 
            active={activeTab === 'teams'} 
            onClick={() => setActiveTab('teams')} 
          />
          <SidebarItem 
            icon={Calendar} 
            label={isSidebarOpen ? "Fixtures" : ""} 
            active={activeTab === 'fixtures'} 
            onClick={() => setActiveTab('fixtures')} 
          />
        </nav>

        <div className="p-4 border-t border-slate-100">
          <SidebarItem 
            icon={LogOut} 
            label={isSidebarOpen ? "Sign Out" : ""} 
            onClick={handleLogout} 
          />
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-8 sticky top-0 z-10">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-slate-50 rounded-lg text-slate-500"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-semibold text-slate-900">{user?.email?.split('@')[0]}</span>
              <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Scorer</span>
            </div>
            <div className="w-10 h-10 bg-slate-100 rounded-full border-2 border-white shadow-sm overflow-hidden">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} alt="Avatar" />
            </div>
          </div>
        </header>

        {/* Offline Banner */}
        {!isOnline && (
          <div className="bg-red-50 border-b border-red-100 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 mx-8 mt-8 rounded-2xl animate-pulse">
            <div className="flex items-center gap-3">
              <WifiOff className="text-red-600" size={20} />
              <div className="text-sm">
                <p className="font-bold text-red-900">You are currently offline</p>
                <p className="text-red-700">Network requests will fail until your connection is restored.</p>
              </div>
            </div>
            <button 
              onClick={async () => {
                const url = (import.meta as any).env?.VITE_SUPABASE_URL;
                if (!url) {
                  setStatusMessage({ text: 'Supabase URL not configured.', type: 'error' });
                  return;
                }
                try {
                  console.log('Running network diagnostic...');
                  const start = Date.now();
                  // Use a small timeout for the diagnostic
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 5000);
                  
                  const res = await fetch(url, { 
                    method: 'HEAD', 
                    mode: 'no-cors',
                    signal: controller.signal 
                  });
                  
                  clearTimeout(timeoutId);
                  const duration = Date.now() - start;
                  setStatusMessage({ text: `Network Diagnostic: Success! Reached Supabase in ${duration}ms.`, type: 'success' });
                } catch (err) {
                  setStatusMessage({ text: `Network Diagnostic: Failed to reach Supabase. Error: ${err instanceof Error ? err.message : String(err)}`, type: 'error' });
                }
              }}
              className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors shadow-sm"
            >
              Run Network Diagnostic
            </button>
          </div>
        )}

        {/* Supabase Error Banner */}
        {(!(import.meta as any).env?.VITE_SUPABASE_URL || (import.meta as any).env?.VITE_SUPABASE_URL === 'https://placeholder.supabase.co' || supabaseError || !navigator.onLine) && (
          <div className="bg-amber-50 border-b border-amber-100 p-4 flex items-center justify-between mx-8 mt-8 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                {!navigator.onLine ? <WifiOff size={20} /> : <AlertCircle size={20} />}
              </div>
              <div className="text-sm">
                <p className="font-bold text-amber-900">
                  {!navigator.onLine ? 'You are offline' : (supabaseError ? `Supabase Error: ${supabaseError}` : 'Supabase Credentials Missing')}
                </p>
                <p className="text-amber-700">
                  {!navigator.onLine 
                    ? 'Please check your internet connection to continue using the app.'
                    : (supabaseError 
                      ? 'Please check your Supabase configuration and network connection.' 
                      : 'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables via the Settings menu.')}
                </p>
              </div>
            </div>
            <button 
              onClick={() => {
                fetchTournaments();
                fetchMatches();
                fetchTeams();
              }}
              className="bg-amber-100 text-amber-700 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-amber-200 transition-colors"
            >
              <RotateCcw size={16} />
              Retry
            </button>
          </div>
        )}

        {/* Content Area */}
        <div className="p-8 max-w-7xl mx-auto w-full">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900">Welcome back!</h2>
                    <p className="text-slate-500 mt-1">Here's what's happening in your tournaments.</p>
                  </div>
                  <button 
                    onClick={() => setShowNewTournamentModal(true)}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-200"
                  >
                    <Plus size={20} />
                    New Tournament
                  </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { label: 'Active Matches', value: matches.length.toString(), color: 'bg-emerald-500' },
                    { label: 'Total Tournaments', value: tournaments.length.toString(), color: 'bg-indigo-500' },
                    { label: 'Upcoming Fixtures', value: '0', color: 'bg-amber-500' },
                  ].map((stat, i) => (
                    <Card key={i} className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
                          <p className="text-4xl font-bold text-slate-900 mt-2">{stat.value}</p>
                        </div>
                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white", stat.color)}>
                          <LayoutDashboard size={24} />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Recent Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card>
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="font-bold text-slate-900">Live Matches</h3>
                      <button className="text-indigo-600 text-sm font-semibold hover:underline">View All</button>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {matches.length > 0 ? matches.map((match, i) => (
                        <div 
                          key={i} 
                          onClick={() => {
                            setActiveTab(`scoring-${match.id}`);
                          }}
                          className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-6">
                            <div className="text-center">
                              <p className="font-bold text-slate-900">{match.team_a?.name || 'Team A'}</p>
                              <p className="text-xs text-slate-400 mt-1">vs</p>
                              <p className="font-bold text-slate-900">{match.team_b?.name || 'Team B'}</p>
                            </div>
                            <div className="h-10 w-px bg-slate-100" />
                            <div>
                              <p className="text-xl font-black text-indigo-600">{match.score || '0/0 (0.0)'}</p>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">{match.status}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">Score Now</span>
                            <ChevronRight size={20} className="text-slate-300 group-hover:text-indigo-600 transition-colors" />
                          </div>
                        </div>
                      )) : (
                        <div className="p-12 text-center text-slate-400">
                          <Tv size={48} className="mx-auto mb-4 opacity-20" />
                          <p>No live matches at the moment.</p>
                        </div>
                      )}
                    </div>
                  </Card>

                  <Card>
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="font-bold text-slate-900">Upcoming Fixtures</h3>
                      <button className="text-indigo-600 text-sm font-semibold hover:underline">View Schedule</button>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {[
                        { teams: 'Kolkata vs Punjab', time: 'Today, 7:30 PM', venue: 'Eden Gardens' },
                        { teams: 'Rajasthan vs Gujarat', time: 'Tomorrow, 3:30 PM', venue: 'Sawai Mansingh' },
                      ].map((fixture, i) => (
                        <div key={i} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                              <Calendar size={20} />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{fixture.teams}</p>
                              <p className="text-sm text-slate-500 mt-0.5">{fixture.time} • {fixture.venue}</p>
                            </div>
                          </div>
                          <button className="px-4 py-2 text-sm font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                            Details
                          </button>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </motion.div>
            )}

            {activeTab.startsWith('scoring-') && (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-4 mb-8">
                  <button 
                    onClick={() => setActiveTab('dashboard')}
                    className="p-2 hover:bg-white rounded-xl text-slate-500 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
                <ScoringPanel matchId={activeTab.replace('scoring-', '')} user={user} />
              </motion.div>
            )}

            {activeTab === 'tournaments' && (
              <motion.div
                key="tournaments"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-bold text-slate-900">Tournaments</h2>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        placeholder="Search tournaments..." 
                        className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-64"
                      />
                    </div>
                    <button 
                      onClick={() => setShowNewTournamentModal(true)}
                      className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all flex items-center gap-2"
                    >
                      <Plus size={20} />
                      Create
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {tournaments.length > 0 ? tournaments.map((t, i) => (
                    <Card key={i} className="group relative cursor-pointer hover:border-indigo-200 transition-all">
                      <div className="h-32 bg-slate-100 relative">
                        <div className="absolute top-4 right-4 flex gap-2">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                            t.status === 'Active' ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-600"
                          )}>
                            {t.status || 'Active'}
                          </span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTournament(t.id);
                            }}
                            className="p-1.5 bg-white/80 backdrop-blur-sm text-rose-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-50"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="p-6">
                        <h4 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{t.name}</h4>
                        <div className="flex items-center gap-4 mt-4">
                          <div className="flex flex-col">
                            <span className="text-xs text-slate-400 uppercase font-bold">Format</span>
                            <span className="text-sm font-semibold text-slate-700">{t.format}</span>
                          </div>
                          <div className="w-px h-6 bg-slate-100" />
                          <div className="flex flex-col">
                            <span className="text-xs text-slate-400 uppercase font-bold">Overs</span>
                            <span className="text-sm font-semibold text-slate-700">{t.overs}</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )) : (
                    <div className="col-span-full p-12 text-center text-slate-400">
                      <Trophy size={48} className="mx-auto mb-4 opacity-20" />
                      <p>No tournaments found. Create your first one!</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'teams' && (
              <motion.div
                key="teams"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-bold text-slate-900">Teams</h2>
                  <button 
                    onClick={() => setShowNewTeamModal(true)}
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all flex items-center gap-2"
                  >
                    <Plus size={20} />
                    Add Team
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {teams.length > 0 ? teams.map((team, i) => (
                    <Card key={i} className="p-6 group hover:border-indigo-200 transition-all">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
                          <img 
                            src={team.logo_url || `https://api.dicebear.com/7.x/initials/svg?seed=${team.name}`} 
                            alt={team.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">{team.name}</h4>
                          <p className="text-sm text-slate-500 line-clamp-1">{team.tournament?.name || 'No Tournament'}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            setSelectedTeamForPlayers(team);
                          }}
                          className="flex-1 px-4 py-2.5 bg-slate-50 text-slate-600 font-bold rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all text-sm flex items-center justify-center gap-2"
                        >
                          <Users size={16} />
                          View Players ({team.players?.length || 0})
                        </button>
                        <button 
                          onClick={() => {
                            setNewPlayer({ ...newPlayer, team_id: team.id });
                            setShowNewPlayerModal(true);
                          }}
                          className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                          title="Add Player"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                    </Card>
                  )) : (
                    <div className="col-span-full p-12 text-center text-slate-400">
                      <Users size={48} className="mx-auto mb-4 opacity-20" />
                      <p>No teams found. Add your first team!</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'fixtures' && (
              <motion.div
                key="fixtures"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-bold text-slate-900">Fixtures</h2>
                  <button 
                    onClick={() => setShowNewMatchModal(true)}
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all flex items-center gap-2"
                  >
                    <Plus size={20} />
                    Create Match
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {matches.length > 0 ? matches.map((match, i) => (
                    <Card key={i} className="p-6 flex items-center justify-between">
                      <div className="flex items-center gap-8">
                        <div className="text-center min-w-[120px]">
                          <p className="font-bold text-slate-900">{match.team_a?.name || 'Team A'}</p>
                          <p className="text-xs text-slate-400 my-1">vs</p>
                          <p className="font-bold text-slate-900">{match.team_b?.name || 'Team B'}</p>
                        </div>
                        <div className={cn(
                          "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                          match.status === 'Live' ? "bg-emerald-100 text-emerald-600" : 
                          match.status === 'Completed' ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-600"
                        )}>
                          {match.status}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {match.status !== 'Completed' && (
                          <button 
                            onClick={() => {
                              setActiveTab(`scoring-${match.id}`);
                            }}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all"
                          >
                            Score Match
                          </button>
                        )}
                      </div>
                    </Card>
                  )) : (
                    <div className="col-span-full p-12 text-center text-slate-400">
                      <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                      <p>No fixtures found. Create your first match!</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* New Tournament Modal */}
      <AnimatePresence>
        {showNewTournamentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewTournamentModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-bold text-slate-900">New Tournament</h3>
                  <button 
                    onClick={() => setShowNewTournamentModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleCreateTournament} className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Tournament Name</label>
                      <input 
                        type="text" 
                        required
                        value={newTournament.name}
                        onChange={(e) => setNewTournament({...newTournament, name: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        placeholder="e.g. Summer Cup 2024"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Format</label>
                        <select 
                          value={newTournament.format}
                          onChange={(e) => setNewTournament({...newTournament, format: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        >
                          <option value="T20">T20</option>
                          <option value="ODI">ODI</option>
                          <option value="Test">Test</option>
                          <option value="Custom">Custom</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Overs</label>
                        <input 
                          type="number" 
                          required
                          value={isNaN(newTournament.overs) ? "" : newTournament.overs}
                          onChange={(e) => {
                            const val = e.target.value === "" ? NaN : parseInt(e.target.value);
                            setNewTournament({...newTournament, overs: val});
                          }}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Location</label>
                      <input 
                        type="text" 
                        value={newTournament.location}
                        onChange={(e) => setNewTournament({...newTournament, location: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        placeholder="e.g. Mumbai, India"
                      />
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      type="button"
                      onClick={() => setShowNewTournamentModal(false)}
                      className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={loading}
                      className="flex-1 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
                    >
                      {loading ? 'Creating...' : 'Create Tournament'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Team Modal */}
      <AnimatePresence>
        {showNewTeamModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewTeamModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-bold text-slate-900">Add New Team</h3>
                  <button onClick={() => setShowNewTeamModal(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleCreateTeam} className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Team Name</label>
                      <input 
                        type="text" 
                        required
                        value={newTeam.name}
                        onChange={(e) => setNewTeam({...newTeam, name: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        placeholder="e.g. Mumbai Indians"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Tournament</label>
                      <select 
                        required
                        value={newTeam.tournament_id}
                        onChange={(e) => setNewTeam({...newTeam, tournament_id: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      >
                        <option value="">Select Tournament</option>
                        {tournaments.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Team Logo</label>
                      <div className="flex items-center gap-4">
                        <div className="relative w-20 h-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center overflow-hidden group">
                          {newTeam.logo_url ? (
                            <>
                              <img 
                                src={newTeam.logo_url} 
                                alt="Preview" 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                              <button 
                                type="button"
                                onClick={() => setNewTeam({...newTeam, logo_url: ''})}
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                              >
                                <X size={20} className="text-white" />
                              </button>
                            </>
                          ) : (
                            <div className="flex flex-col items-center text-slate-400">
                              {uploadingLogo ? (
                                <Loader2 size={24} className="animate-spin text-indigo-500" />
                              ) : (
                                <ImageIcon size={24} />
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <label className="relative cursor-pointer">
                            <div className={cn(
                              "flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-700 hover:bg-slate-50 transition-all",
                              uploadingLogo && "opacity-50 cursor-not-allowed"
                            )}>
                              <Upload size={16} />
                              {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                            </div>
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*"
                              disabled={uploadingLogo}
                              onChange={handleLogoUpload}
                            />
                          </label>
                          <p className="text-[10px] text-slate-400 mt-1.5">PNG, JPG up to 2MB</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setShowNewTeamModal(false)} className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
                    <button type="submit" disabled={loading} className="flex-1 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50">
                      {loading ? 'Adding...' : 'Add Team'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Player Modal */}
      <AnimatePresence>
        {showNewPlayerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewPlayerModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-bold text-slate-900">Add Player</h3>
                  <button onClick={() => setShowNewPlayerModal(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleCreatePlayer} className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Player Name</label>
                      <input 
                        type="text" 
                        required
                        value={newPlayer.name}
                        onChange={(e) => setNewPlayer({...newPlayer, name: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        placeholder="e.g. Virat Kohli"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Role</label>
                      <select 
                        required
                        value={newPlayer.role}
                        onChange={(e) => setNewPlayer({...newPlayer, role: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      >
                        <option value="Batsman">Batsman</option>
                        <option value="Bowler">Bowler</option>
                        <option value="All-rounder">All-rounder</option>
                        <option value="Wicket-keeper">Wicket-keeper</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setShowNewPlayerModal(false)} className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
                    <button type="submit" disabled={loading} className="flex-1 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50">
                      {loading ? 'Adding...' : 'Add Player'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Match Modal */}
      <AnimatePresence>
        {showNewMatchModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewMatchModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-bold text-slate-900">Create Match</h3>
                  <button onClick={() => setShowNewMatchModal(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleCreateMatch} className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Tournament</label>
                      <select 
                        required
                        value={newMatch.tournament_id}
                        onChange={(e) => setNewMatch({...newMatch, tournament_id: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      >
                        <option value="">Select Tournament</option>
                        {tournaments.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Team A</label>
                        <select 
                          required
                          value={newMatch.team_a_id}
                          onChange={(e) => setNewMatch({...newMatch, team_a_id: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        >
                          <option value="">Select Team A</option>
                          {teams.filter(team => team.tournament_id === newMatch.tournament_id).map(team => (
                            <option key={team.id} value={team.id}>{team.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Team B</label>
                        <select 
                          required
                          value={newMatch.team_b_id}
                          onChange={(e) => setNewMatch({...newMatch, team_b_id: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        >
                          <option value="">Select Team B</option>
                          {teams.filter(team => team.tournament_id === newMatch.tournament_id && team.id !== newMatch.team_a_id).map(team => (
                            <option key={team.id} value={team.id}>{team.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Status</label>
                      <select 
                        value={newMatch.status}
                        onChange={(e) => setNewMatch({...newMatch, status: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      >
                        <option value="Upcoming">Upcoming</option>
                        <option value="Live">Live</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setShowNewMatchModal(false)} className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
                    <button type="submit" disabled={loading} className="flex-1 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50">
                      {loading ? 'Creating...' : 'Create Match'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Team Players Modal */}
      <AnimatePresence>
        {selectedTeamForPlayers && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTeamForPlayers(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center overflow-hidden">
                      <img 
                        src={selectedTeamForPlayers.logo_url || `https://api.dicebear.com/7.x/initials/svg?seed=${selectedTeamForPlayers.name}`} 
                        alt={selectedTeamForPlayers.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900">{selectedTeamForPlayers.name}</h3>
                      <p className="text-sm text-slate-500">Player List</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedTeamForPlayers(null)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {selectedTeamForPlayers.players && selectedTeamForPlayers.players.length > 0 ? (
                    selectedTeamForPlayers.players.map((player: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-indigo-100 hover:bg-white transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 font-bold text-xs">
                            {idx + 1}
                          </div>
                          <span className="font-bold text-slate-700">{player.name}</span>
                        </div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{player.role || 'Player'}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-slate-400">
                      <Users size={48} className="mx-auto mb-4 opacity-20" />
                      <p>No players added to this team yet.</p>
                    </div>
                  )}
                </div>

                <div className="mt-8">
                  <button 
                    onClick={() => {
                      setNewPlayer({ ...newPlayer, team_id: selectedTeamForPlayers.id });
                      setSelectedTeamForPlayers(null);
                      setShowNewPlayerModal(true);
                    }}
                    className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                  >
                    <Plus size={20} />
                    Add New Player
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Status Message */}
      <AnimatePresence>
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={cn(
              "fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border",
              statusMessage.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-700" : 
              statusMessage.type === 'error' ? "bg-rose-50 border-rose-100 text-rose-700" : 
              "bg-indigo-50 border-indigo-100 text-indigo-700"
            )}
          >
            {statusMessage.type === 'success' && <CheckCircle size={20} />}
            {statusMessage.type === 'error' && <AlertCircle size={20} />}
            {statusMessage.type === 'info' && <Info size={20} />}
            <span className="font-bold">{statusMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal && confirmModal.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center",
                    confirmModal.type === 'danger' ? "bg-rose-100 text-rose-600" : "bg-indigo-100 text-indigo-600"
                  )}>
                    {confirmModal.type === 'danger' ? <Trash2 size={24} /> : <Info size={24} />}
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900">{confirmModal.title}</h3>
                </div>
                <p className="text-slate-600 leading-relaxed mb-8">{confirmModal.message}</p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setConfirmModal(null)}
                    className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      confirmModal.onConfirm();
                    }}
                    className={cn(
                      "flex-1 px-6 py-3 text-white font-bold rounded-xl transition-all shadow-lg",
                      confirmModal.type === 'danger' ? "bg-rose-600 hover:bg-rose-700 shadow-rose-200" : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
                    )}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
