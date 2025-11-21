'use client';

import { useState, useEffect } from 'react';
import { useActiveAccount } from "thirdweb/react";
import { supabase } from '@/lib/supabaseClient';
import { Droplets, Loader2 } from 'lucide-react';

export function FaucetPanel() {
  const account = useActiveAccount();
  const address = account?.address;
  
  const [loading, setLoading] = useState(false);
  const [nextClaimTime, setNextClaimTime] = useState<Date | null>(null);
  const [canClaim, setCanClaim] = useState(false);

  useEffect(() => {
    if (!address) return;

    const checkEligibility = async () => {
      const { data: user } = await supabase
        .from('users')
        .select('last_faucet_claim_at')
        .eq('wallet_address', address)
        .single();
      
      if (user) {
        if (!user.last_faucet_claim_at) {
            setCanClaim(true);
            setNextClaimTime(null);
        } else {
            const lastClaim = new Date(user.last_faucet_claim_at);
            const now = new Date();
            const diff = now.getTime() - lastClaim.getTime();
            const hours24 = 24 * 60 * 60 * 1000;
            
            if (diff >= hours24) {
                setCanClaim(true);
                setNextClaimTime(null);
            } else {
                setCanClaim(false);
                setNextClaimTime(new Date(lastClaim.getTime() + hours24));
            }
        }
      }
    };

    checkEligibility();
    const interval = setInterval(checkEligibility, 60000); // Recheck every minute
    return () => clearInterval(interval);
  }, [address]);

  const handleClaim = async () => {
    if (!address || !canClaim) return;
    setLoading(true);

    try {
        // 1. Get User ID
        const { data: user } = await supabase.from('users').select('id').eq('wallet_address', address).single();
        if (!user) throw new Error("User not found");

        // 2. Upsert Balance (FAKEUSD symbol is usually 'FAKEUSD' or special case)
        // We use RPC or manual checks usually, but for V1 direct table access:
        
        // Check existing balance
        const { data: balance } = await supabase
            .from('user_balances')
            .select('amount')
            .eq('user_id', user.id)
            .eq('symbol', 'FAKEUSD')
            .single();
        
        const currentAmount = Number(balance?.amount || 0);
        const newAmount = currentAmount + 1000;

        // Update/Insert Balance
        const { error: balanceError } = await supabase
            .from('user_balances')
            .upsert({ 
                user_id: user.id, 
                symbol: 'FAKEUSD', 
                amount: newAmount 
            }, { onConflict: 'user_id, symbol' });

        if (balanceError) throw balanceError;

        // 3. Update Claim Timestamp
        const { error: userError } = await supabase
            .from('users')
            .update({ last_faucet_claim_at: new Date().toISOString() })
            .eq('id', user.id);

        if (userError) throw userError;

        // Success UI
        setCanClaim(false);
        const now = new Date();
        setNextClaimTime(new Date(now.getTime() + 24 * 60 * 60 * 1000));
        alert("Successfully claimed 1000 FAKEUSD! Don't spend it all in one place.");

    } catch (err) {
        console.error("Claim failed:", err);
        alert("Claim failed. See console for details.");
    } finally {
        setLoading(false);
    }
  };

  if (!address) return null;

  return (
    <div className="glass-panel rounded-xl p-4 border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-900/50 relative overflow-hidden group">
      {/* Background Glow */}
      <div className="absolute -right-10 -top-10 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
      
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-900/30 rounded-lg text-blue-400">
                <Droplets className="w-5 h-5" />
            </div>
            <div>
                <h3 className="text-sm font-bold text-gray-200">Daily Faucet</h3>
                <p className="text-xs text-gray-500">
                    {canClaim 
                        ? "Ready to claim" 
                        : nextClaimTime 
                            ? `Next: ${nextClaimTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` 
                            : "Loading..."}
                </p>
            </div>
        </div>
        
        <button 
            onClick={handleClaim}
            disabled={!canClaim || loading}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all flex items-center gap-2
                ${canClaim && !loading
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/50' 
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }`}
        >
            {loading && <Loader2 className="w-3 h-3 animate-spin" />}
            {loading ? "Minting..." : "Claim 1k"}
        </button>
      </div>
    </div>
  );
}
