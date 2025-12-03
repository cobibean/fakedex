'use client';

import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import type { User as UserProfile, Achievement, Trade, Comment } from '@/lib/types';
import { AchievementsGrid } from '@/components/xp/AchievementsGrid';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileStats, generateMockStats } from '@/components/profile/ProfileStats';
import { TradeHistory } from '@/components/profile/TradeHistory';
import { CommentSection } from '@/components/profile/CommentSection';
import { Loader2, Trophy, History, MessageCircle, BarChart3 } from 'lucide-react';
import { useActiveAccount } from 'thirdweb/react';
import { DEFAULT_ACHIEVEMENTS } from '@/lib/mockData';

type TabType = 'stats' | 'trades' | 'achievements' | 'comments';

export default function ProfilePage() {
  const account = useActiveAccount();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>(DEFAULT_ACHIEVEMENTS);
  const [earnedIds, setEarnedIds] = useState<Set<string>>(new Set());
  const [trades, setTrades] = useState<Trade[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('stats');
  const [stats, setStats] = useState({ trades: 0, volume: 0 });

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      if (!account?.address || !isSupabaseConfigured || !supabase) {
        if (!ignore) setLoading(false);
        return;
      }

      if (!ignore) setLoading(true);

      // Fetch user profile
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', account.address)
        .single();

      // Fetch achievements
      const { data: allAch } = await supabase.from('achievements').select('*');
      const { data: userAch } = await supabase
        .from('user_achievements')
        .select('achievement_id')
        .eq('user_id', user?.id);

      if (!ignore) {
        if (user) setProfile(user);
        if (allAch) setAchievements(allAch);
        if (userAch) setEarnedIds(new Set(userAch.map((ua) => ua.achievement_id)));
      }

      // Fetch trades and stats
      if (user) {
        const { count, data: tradeData } = await supabase
          .from('trades')
          .select('*', { count: 'exact' })
          .eq('user_id', user.id)
          .eq('is_bot', false)
          .order('created_at', { ascending: false })
          .limit(50);

        const vol = tradeData?.reduce((acc, t) => acc + Number(t.size_fakeusd), 0) || 0;
        
        if (!ignore) {
          setStats({ trades: count || 0, volume: vol });
          setTrades(tradeData || []);
        }
      }

      if (!ignore) setLoading(false);
    };

    load();
    return () => {
      ignore = true;
    };
  }, [account?.address]);

  const handleAddComment = async (content: string) => {
    if (!profile || !supabase) return;
    
    // In a real app, this would insert into a comments table
    // For now, we'll just add it locally
    const newComment: Comment = {
      id: Date.now().toString(),
      user_id: profile.id,
      profile_id: profile.id,
      content,
      created_at: new Date().toISOString(),
      user: {
        username: profile.username,
        wallet_address: profile.wallet_address,
        level: profile.level,
      },
    };
    setComments((prev) => [newComment, ...prev]);
  };

  // Generate mock stats based on real data
  const fullStats = generateMockStats(stats.trades, stats.volume);

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
        <div className="text-6xl">🔐</div>
        <p className="font-mono text-lg">Connect wallet to view profile</p>
        <p className="text-sm text-gray-600">Your degen stats await...</p>
      </div>
    );
  }

  if (!isSupabaseConfigured || !supabase) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
        <div className="text-6xl">⚙️</div>
        <p className="font-mono">Configure Supabase to enable profiles</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        <p className="text-gray-500 font-mono text-sm">Loading degen profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
        <div className="text-6xl">👻</div>
        <p className="font-mono text-lg">Profile not found</p>
        <p className="text-sm text-gray-600">Make a trade to initialize your degen journey.</p>
      </div>
    );
  }

  const tabs = [
    { id: 'stats' as TabType, label: 'Stats', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'trades' as TabType, label: 'Trades', icon: <History className="w-4 h-4" />, count: stats.trades },
    { id: 'achievements' as TabType, label: 'Badges', icon: <Trophy className="w-4 h-4" />, count: earnedIds.size },
    { id: 'comments' as TabType, label: 'Wall', icon: <MessageCircle className="w-4 h-4" />, count: comments.length || 3 },
  ];

  return (
    <div className="max-w-4xl mx-auto pb-12">
      {/* Profile Header */}
      <div className="glass-panel rounded-2xl border border-gray-800 overflow-hidden mb-6">
        <ProfileHeader profile={profile} isOwnProfile={true} />
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 bg-gray-900/50 p-1 rounded-xl overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-mono text-sm transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                activeTab === tab.id ? 'bg-purple-500' : 'bg-gray-700'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="glass-panel rounded-2xl border border-gray-800 p-6">
        {activeTab === 'stats' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-500" />
              Trading Stats
            </h2>
            <ProfileStats stats={fullStats} />
            
            {/* Fun Degen Metrics */}
            <div className="mt-8 p-4 bg-gradient-to-r from-purple-900/20 to-pink-900/20 rounded-xl border border-purple-500/20">
              <h3 className="text-sm font-bold text-purple-400 mb-3">🎰 Degen Score</h3>
              <div className="flex items-center gap-4">
                <div className="text-5xl font-bold text-white">
                  {Math.min(100, Math.floor(fullStats.avgLeverage * 3 + fullStats.totalTrades * 0.5))}
                </div>
                <div className="text-sm text-gray-400">
                  <p>Based on leverage usage, trade frequency, and overall recklessness.</p>
                  <p className="text-purple-400 mt-1">
                    {fullStats.avgLeverage >= 20 ? '⚠️ Certified degen behavior detected' : 'Room for more degeneracy'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'trades' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <History className="w-5 h-5 text-blue-500" />
              Trade History
            </h2>
            <TradeHistory trades={trades} />
          </div>
        )}

        {activeTab === 'achievements' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Achievements
              </h2>
              <span className="text-sm text-gray-500 font-mono">
                {earnedIds.size} / {achievements.length} unlocked
              </span>
            </div>
            <AchievementsGrid achievements={achievements} earnedIds={earnedIds} />
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-pink-500" />
              Profile Wall
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Leave comments, flex your wins, or roast other degens.
            </p>
            <CommentSection 
              comments={comments} 
              onAddComment={handleAddComment}
              isOwnProfile={true}
              canComment={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}
