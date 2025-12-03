'use client';

import { useEffect } from 'react';
import { useActiveAccount } from "thirdweb/react";
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

export function useAuthSync() {
  const account = useActiveAccount();
  const address = account?.address;

  useEffect(() => {
    if (!address || !isSupabaseConfigured || !supabase) return;

    const syncUser = async () => {
      try {
        // Check if user exists
        const { data: existingUser, error: fetchError } = await supabase
          .from('users')
          .select('id')
          .eq('wallet_address', address)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "not found"
          // Only log if there's actual error content
          if (fetchError.message || fetchError.details) {
            console.error("Error checking user:", fetchError.message || fetchError.details);
          }
          return;
        }

        if (!existingUser) {
          // Create new user
          const { error: insertError } = await supabase
            .from('users')
            .insert([
              { 
                wallet_address: address,
                username: `Degen_${address.slice(0, 6)}`, // Default username
                level: 1,
                xp: 0
              }
            ]);

          if (insertError) {
            console.error("Error creating user:", insertError);
          } else {
            console.log("New user created for:", address);
          }
        } else {
            // Update last login
            await supabase
                .from('users')
                .update({ last_login_at: new Date().toISOString() })
                .eq('id', existingUser.id);
        }
      } catch (err) {
        console.error("Auth sync error:", err);
      }
    };

    syncUser();
  }, [address]);
}
