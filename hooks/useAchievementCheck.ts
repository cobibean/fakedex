import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useActiveAccount } from "thirdweb/react";

export function useAchievementCheck() {
  const account = useActiveAccount();

  useEffect(() => {
    if (!account?.address) return;

    // Listen for NEW trades by this user
    const subscription = supabase
      .channel('achievement-checker')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'trades' 
        // Note: Filter by user_id in filter string is tricky if we don't have ID handy synchronously.
        // We'll filter in callback.
      }, async (payload) => {
        const trade = payload.new;
        
        // Fetch user ID to confirm match (or assume client context if we pass user ID)
        // To keep it simple: We check triggers for *any* trade inserted, 
        // and if it matches our current wallet's User ID, we award.
        // Ideally: RLS handles security, but client side trigger is for immediate feedback/toast.
        // The real logic should probably be a DB trigger or Edge Function.
        // For V1 client-side simulation:
        
        // 1. Get Current User
        const { data: user } = await supabase
            .from('users')
            .select('id')
            .eq('wallet_address', account.address)
            .single();
            
        if (!user || trade.user_id !== user.id) return;

        // 2. Check Triggers
        const earnedBadges = [];

        // CHECK: SIZE_MATTERS (Leverage >= 10)
        if (trade.leverage >= 10) {
            earnedBadges.push('SIZE_MATTERS');
        }

        // CHECK: PREMATURE_EXIT
        // Requires tracking open/close time. Not applicable on *opening* a trade (INSERT).
        // Would need 'UPDATE' or separate 'close' event. Skipping for V1 trade entry.

        // 3. Award Achievements
        if (earnedBadges.length > 0) {
            // Fetch IDs
            const { data: badges } = await supabase
                .from('achievements')
                .select('id, name')
                .in('code', earnedBadges);
            
            if (badges) {
                for (const badge of badges) {
                    const { error } = await supabase
                        .from('user_achievements')
                        .insert({ user_id: user.id, achievement_id: badge.id })
                        .ignoreDuplicates(); // Important!
                    
                    if (!error) {
                        alert(`🏆 ACHIEVEMENT UNLOCKED: ${badge.name}`);
                    }
                }
            }
        }
        
        // 4. Award XP (Simple: 10 XP per trade)
        await supabase.rpc('increment_xp', { user_id: user.id, amount: 10 }); 
        // Note: We need to create this RPC or just update manually. 
        // Manual update for V1:
        const { data: currentUser } = await supabase.from('users').select('xp, level').eq('id', user.id).single();
        if (currentUser) {
            const newXp = currentUser.xp + 10;
            // Simple level curve: Level = floor(XP / 100) + 1
            const newLevel = Math.floor(newXp / 100) + 1;
            await supabase.from('users').update({ xp: newXp, level: newLevel }).eq('id', user.id);
        }

      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [account?.address]);
}

