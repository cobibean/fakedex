import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { useActiveAccount } from "thirdweb/react";
import { DEFAULT_PROFILE } from '@/lib/mockData';
import type { User as UserProfile } from '@/lib/types';

export function useXP() {
  const account = useActiveAccount();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!account?.address || !isSupabaseConfigured || !supabase) {
      setProfile(DEFAULT_PROFILE);
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('wallet_address', account.address)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error("Error fetching XP:", error);
        }
        
        if (data) {
          setProfile(data);
        } else {
          setProfile(DEFAULT_PROFILE);
        }
      } catch (err) {
        console.error("XP hook error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    // Realtime subscription for XP updates
    if (!isSupabaseConfigured || !supabase) return;

    const subscription = supabase
      .channel('xp-updates')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'users',
        filter: `wallet_address=eq.${account.address}` 
      }, (payload) => {
        setProfile(payload.new as UserProfile);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [account?.address]);

  return { profile, loading };
}

