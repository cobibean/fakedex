'use client';

import { useState, useEffect } from 'react';
import { useActiveAccount, useSendTransaction, useReadContract } from "thirdweb/react";
import { getContract, prepareContractCall } from "thirdweb";
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { client, sepoliaChain } from '@/lib/thirdwebClient';
import { TFAKEUSD_ADDRESS, TFAKEUSD_ABI } from '@/lib/contracts';
import { Droplets, Loader2, CheckCircle, ExternalLink, AlertCircle } from 'lucide-react';

// Get the tFAKEUSD contract instance
const tfakeusdContract = getContract({
  client,
  chain: sepoliaChain,
  address: TFAKEUSD_ADDRESS,
  abi: TFAKEUSD_ABI,
});

export function FaucetPanel() {
  const account = useActiveAccount();
  const address = account?.address;
  
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Read on-chain data
  const { data: canMintOnChain, refetch: refetchCanMint } = useReadContract({
    contract: tfakeusdContract,
    method: "canMint",
    params: address ? [address] : undefined,
  });

  const { data: timeUntilMint, refetch: refetchTime } = useReadContract({
    contract: tfakeusdContract,
    method: "timeUntilNextMint", 
    params: address ? [address] : undefined,
  });

  const { data: balance, refetch: refetchBalance } = useReadContract({
    contract: tfakeusdContract,
    method: "balanceOf",
    params: address ? [address] : undefined,
  });

  // Transaction hook
  const { mutateAsync: sendTransaction, isPending: isTxPending } = useSendTransaction();

  // Format balance for display
  const formattedBalance = balance 
    ? (Number(balance) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 })
    : '0';

  // Calculate next claim time
  const getNextClaimTime = () => {
    if (!timeUntilMint || timeUntilMint === 0n) return null;
    const seconds = Number(timeUntilMint);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const canClaim = canMintOnChain === true;

  const handleClaim = async () => {
    if (!address || !canClaim) return;
    
    setLoading(true);
    setError(null);
    setTxHash(null);

    try {
      // Prepare the claim transaction
      const transaction = prepareContractCall({
        contract: tfakeusdContract,
        method: "claim",
        params: [],
      });

      // Send the transaction
      const result = await sendTransaction(transaction);
      
      setTxHash(result.transactionHash);

      // Update Supabase tracking (for additional off-chain tracking)
      if (isSupabaseConfigured && supabase) {
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('wallet_address', address)
          .single();
        
        if (user) {
          // Update last claim time
          await supabase
            .from('users')
            .update({ last_faucet_claim_at: new Date().toISOString() })
            .eq('id', user.id);

          // Update balance in Supabase (for off-chain trading)
          const { data: currentBalance } = await supabase
            .from('user_balances')
            .select('amount')
            .eq('user_id', user.id)
            .eq('symbol', 'FAKEUSD')
            .single();
          
          const newAmount = (Number(currentBalance?.amount || 0) + 1000);
          
          await supabase
            .from('user_balances')
            .upsert({ 
              user_id: user.id, 
              symbol: 'FAKEUSD', 
              amount: newAmount 
            }, { onConflict: 'user_id, symbol' });
        }
      }

      // Refetch on-chain data
      setTimeout(() => {
        refetchCanMint();
        refetchTime();
        refetchBalance();
      }, 2000);

    } catch (err: unknown) {
      console.error("Claim failed:", err);
      const errorMessage = err instanceof Error ? err.message : "Transaction failed";
      setError(errorMessage.includes("user rejected") 
        ? "Transaction cancelled" 
        : "Claim failed. Make sure you're on Sepolia network.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh data periodically
  useEffect(() => {
    if (!address) return;
    
    const interval = setInterval(() => {
      refetchCanMint();
      refetchTime();
      refetchBalance();
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, [address, refetchCanMint, refetchTime, refetchBalance]);

  if (!address) {
    return (
      <div className="glass-panel rounded-xl p-4 border border-gray-800">
        <div className="text-sm text-gray-500">Connect your wallet to access the daily faucet.</div>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-xl p-4 border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-900/50 relative overflow-hidden group">
      {/* Background Glow */}
      <div className="absolute -right-10 -top-10 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
      
      <div className="relative z-10 space-y-3">
        {/* Header Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-900/30 rounded-lg text-blue-400">
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-200">Daily Faucet</h3>
              <p className="text-xs text-gray-500">
                {canClaim 
                  ? "Ready to claim!" 
                  : getNextClaimTime() 
                    ? `Next: ${getNextClaimTime()}` 
                    : "Loading..."}
              </p>
            </div>
          </div>
          
          <button 
            onClick={handleClaim}
            disabled={!canClaim || loading || isTxPending}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all flex items-center gap-2
              ${canClaim && !loading && !isTxPending
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/50' 
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
              }`}
          >
            {(loading || isTxPending) && <Loader2 className="w-3 h-3 animate-spin" />}
            {loading || isTxPending ? "Minting..." : "Claim 1k"}
          </button>
        </div>

        {/* Balance Display */}
        <div className="flex items-center justify-between text-xs border-t border-gray-800 pt-3">
          <span className="text-gray-500">Your tFAKEUSD Balance:</span>
          <span className="font-mono text-green-400 font-bold">{formattedBalance}</span>
        </div>

        {/* Success Message */}
        {txHash && (
          <div className="flex items-center gap-2 text-xs bg-green-900/20 text-green-400 p-2 rounded border border-green-500/20">
            <CheckCircle className="w-4 h-4" />
            <span>Claimed 1,000 tFAKEUSD!</span>
            <a 
              href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto hover:text-green-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 text-xs bg-red-900/20 text-red-400 p-2 rounded border border-red-500/20">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Network Notice */}
        <div className="text-[10px] text-gray-600 text-center">
          Sepolia Testnet • Tokens have no real value
        </div>
      </div>
    </div>
  );
}
