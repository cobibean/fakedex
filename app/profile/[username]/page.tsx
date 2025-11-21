'use client';

import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import type { User as UserProfile, Achievement } from '@/lib/types';
import { AchievementsGrid } from '@/components/xp/AchievementsGrid';
import { Loader2, Trophy, TrendingDown, TrendingUp } from 'lucide-react';
import { useActiveAccount } from 'thirdweb/react';
import { DEFAULT_ACHIEVEMENTS } from '@/lib/mockData';

export default function ProfilePage() {
    const account = useActiveAccount();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [achievements, setAchievements] = useState<Achievement[]>(DEFAULT_ACHIEVEMENTS);
    const [earnedIds, setEarnedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ trades: 0, volume: 0 });

    useEffect(() => {
        let ignore = false;

        const load = async () => {
            if (!account?.address || !isSupabaseConfigured || !supabase) {
                if (!ignore) setLoading(false);
                return;
            }

            if (!ignore) setLoading(true);

            const { data: user } = await supabase
                .from('users')
                .select('*')
                .eq('wallet_address', account.address)
                .single();

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

            if (user) {
                const { count, data: tradeData } = await supabase
                    .from('trades')
                    .select('size_fakeusd', { count: 'exact' })
                    .eq('user_id', user.id);
                const vol = tradeData?.reduce((acc, t) => acc + Number(t.size_fakeusd), 0) || 0;
                if (!ignore) setStats({ trades: count || 0, volume: vol });
            }

            if (!ignore) setLoading(false);
        };

        load();
        return () => {
            ignore = true;
        };
    }, [account?.address]);

    if (!account) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500 font-mono">
                Connect wallet to view profile
            </div>
        );
    }

    if (!isSupabaseConfigured || !supabase) {
        return (
            <div className="p-8 text-center text-gray-500">
                Configure Supabase to enable profile stats and achievements.
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
            </div>
        );
    }

    if (!profile) {
        return <div className="p-8 text-center">Profile not found. Trade to initialize.</div>;
    }

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-8">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-gray-800 pb-6">
                <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-xl shadow-purple-900/20">
                        {profile.username?.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-white">{profile.username}</h1>
                        <div className="flex items-center gap-2 text-gray-500 font-mono text-sm">
                            <span>{account.address.slice(0, 6)}...{account.address.slice(-4)}</span>
                            <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                            <span>Joined {new Date(profile.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex gap-4">
                    <div className="text-right">
                        <div className="text-xs text-gray-500 uppercase tracking-wider">Level</div>
                        <div className="text-3xl font-bold text-yellow-500">{profile.level}</div>
                    </div>
                    <div className="text-right pl-4 border-l border-gray-800">
                        <div className="text-xs text-gray-500 uppercase tracking-wider">XP</div>
                        <div className="text-3xl font-bold text-white">{profile.xp}</div>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-panel p-4 rounded-xl border border-gray-800">
                    <div className="flex items-center gap-2 text-gray-400 mb-2">
                        <TrendingUp className="w-4 h-4" /> Total Volume
                    </div>
                    <div className="text-2xl font-mono text-green-400">${stats.volume.toLocaleString()}</div>
                </div>
                <div className="glass-panel p-4 rounded-xl border border-gray-800">
                    <div className="flex items-center gap-2 text-gray-400 mb-2">
                        <Loader2 className="w-4 h-4" /> Total Trades
                    </div>
                    <div className="text-2xl font-mono text-blue-400">{stats.trades}</div>
                </div>
                <div className="glass-panel p-4 rounded-xl border border-gray-800">
                    <div className="flex items-center gap-2 text-gray-400 mb-2">
                        <TrendingDown className="w-4 h-4" /> PnL (Fake)
                    </div>
                    <div className="text-2xl font-mono text-red-400">-$420.69</div>
                    <div className="text-xs text-gray-600 italic">Always rekt.</div>
                </div>
            </div>

            {/* Achievements */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    <h2 className="text-xl font-bold">Achievements</h2>
                    <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                        {earnedIds.size} / {achievements.length}
                    </span>
                </div>
                <AchievementsGrid achievements={achievements} earnedIds={earnedIds} />
            </div>

        </div>
    );
}

