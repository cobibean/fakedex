'use client';

import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import type { User as UserProfile, Achievement, Trade, Comment } from '@/lib/types';
import { AchievementsGrid } from '@/components/xp/AchievementsGrid';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileStats } from '@/components/profile/ProfileStats';
import { TradeHistory } from '@/components/profile/TradeHistory';
import { CommentSection } from '@/components/profile/CommentSection';
import { Loader2, Trophy, History, MessageCircle, BarChart3, Zap } from 'lucide-react';
import { useActiveAccount } from 'thirdweb/react';
import { DEFAULT_ACHIEVEMENTS } from '@/lib/mockData';
import { calculateUserStats, DEFAULT_STATS, UserStats } from '@/lib/statsService';
import { Position } from '@/lib/positionService';

type TabType = 'stats' | 'positions' | 'trades' | 'achievements' | 'comments';

export default function ProfilePage() {
  const account = useActiveAccount();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>(DEFAULT_ACHIEVEMENTS);
  const [earnedIds, setEarnedIds] = useState<Set<string>>(new Set());
  const [trades, setTrades] = useState<Trade[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('stats');
  const [userStats, setUserStats] = useState<UserStats>(DEFAULT_STATS);

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

      // Fetch data if user exists
      if (user) {
        // Fetch trades
        const { data: tradeData } = await supabase
          .from('trades')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_bot', false)
          .order('created_at', { ascending: false })
          .limit(50);

        // Fetch positions
        const { data: positionData } = await supabase
          .from('positions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        // Calculate real stats
        const stats = await calculateUserStats(user.id);
        
        if (!ignore) {
          setTrades(tradeData || []);
          setPositions(positionData || []);
          setUserStats(stats);
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

  // Calculate degen score
  const degenScore = Math.min(100, Math.floor(
    userStats.avgLeverage * 2 + 
    userStats.totalTrades * 0.5 + 
    userStats.liquidationCount * 5
  ));

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

  const openPositions = positions.filter(p => p.status === 'open');
  const closedPositions = positions.filter(p => p.status !== 'open');

  const tabs = [
    { id: 'stats' as TabType, label: 'Stats', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'positions' as TabType, label: 'Positions', icon: <Zap className="w-4 h-4" />, count: openPositions.length },
    { id: 'trades' as TabType, label: 'History', icon: <History className="w-4 h-4" />, count: closedPositions.length },
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
            <ProfileStats stats={userStats} />
            
            {/* Degen Score */}
            <div className="mt-8 p-4 bg-gradient-to-r from-purple-900/20 to-pink-900/20 rounded-xl border border-purple-500/20">
              <h3 className="text-sm font-bold text-purple-400 mb-3">🎰 Degen Score</h3>
              <div className="flex items-center gap-4">
                <div className="text-5xl font-bold text-white">
                  {degenScore}
                </div>
                <div className="text-sm text-gray-400">
                  <p>Based on leverage usage, trade frequency, and liquidation count.</p>
                  <p className="text-purple-400 mt-1">
                    {degenScore >= 80 
                      ? '🔥 Maximum degen achieved' 
                      : degenScore >= 50 
                        ? '⚠️ Certified degen behavior detected' 
                        : 'Room for more degeneracy'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'positions' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Open Positions
            </h2>
            {openPositions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-2">📊</div>
                <p className="font-mono">No open positions</p>
                <p className="text-xs text-gray-600 mt-1">Open a trade from the dashboard</p>
              </div>
            ) : (
              <div className="space-y-2">
                {openPositions.map((pos) => (
                  <div key={pos.id} className="p-4 bg-gray-900/50 rounded-lg border border-gray-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-bold ${pos.side === 'long' ? 'text-green-400' : 'text-red-400'}`}>
                          {pos.side.toUpperCase()}
                        </span>
                        <span className="font-mono text-white">{pos.symbol}</span>
                        <span className="text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">
                          {pos.leverage}x
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-white">${Number(pos.size_fakeusd).toLocaleString()}</div>
                        <div className="text-xs text-gray-500">@ ${Number(pos.entry_price).toFixed(5)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'trades' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <History className="w-5 h-5 text-blue-500" />
              Position History
            </h2>
            {closedPositions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-2">📉</div>
                <p className="font-mono">No closed positions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {closedPositions.map((pos) => {
                  const isProfitable = Number(pos.realized_pnl) >= 0;
                  return (
                    <div key={pos.id} className="p-4 bg-gray-900/50 rounded-lg border border-gray-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            pos.status === 'liquidated' 
                              ? 'bg-red-500/20 text-red-400' 
                              : 'bg-gray-700 text-gray-400'
                          }`}>
                            {pos.status.toUpperCase()}
                          </span>
                          <span className={`text-sm font-bold ${pos.side === 'long' ? 'text-green-400' : 'text-red-400'}`}>
                            {pos.side.toUpperCase()}
                          </span>
                          <span className="font-mono text-white">{pos.symbol}</span>
                          <span className="text-xs text-gray-500">{pos.leverage}x</span>
                        </div>
                        <div className="text-right">
                          <div className={`font-mono font-bold ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
                            {isProfitable ? '+' : ''}{Number(pos.realized_pnl).toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-500">
                            ${Number(pos.entry_price).toFixed(5)} → ${Number(pos.exit_price).toFixed(5)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
