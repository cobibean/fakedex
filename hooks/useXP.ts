import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useActiveAccount } from "thirdweb/react";

export interface UserProfile {
  id: string;
  username: string;
  xp: number;
  level: number;
  avatar: string;
}

export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  nsfw_flag: boolean;
  earned_at?: string; // If joined with user_achievements
}

export function useXP() {
  const account = useActiveAccount();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!account?.address) {
      setProfile(null);
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
        }
      } catch (err) {
        console.error("XP hook error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    // Realtime subscription for XP updates
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

