'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, BarChart2, Trophy, Droplets, Loader2, TrendingUp, Shield } from 'lucide-react';
import { clsx } from 'clsx';
import { useActiveAccount, useSendTransaction, useReadContract } from "thirdweb/react";
import { getContract, prepareContractCall } from "thirdweb";
import { client, sepoliaChain } from '@/lib/thirdwebClient';
import { TFAKEUSD_ADDRESS, TFAKEUSD_ABI, ESCROW_ADDRESS, ESCROW_ABI } from '@/lib/contracts';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { useState, useEffect } from 'react';

// Admin wallet address
const ADMIN_ADDRESS = "0x5d92A2486042Dd4cEE0BD6B5ffd98a8C3A6EA4Fe";

const NAV_ITEMS = [
  { label: 'Terminal', href: '/', icon: BarChart2 },
  { label: 'Profile', href: '/profile/me', icon: User },
  { label: 'Leaderboard', href: '/leaderboard', icon: Trophy },
];

// Get the tFAKEUSD contract instance
const tfakeusdContract = getContract({
  client,
  chain: sepoliaChain,
  address: TFAKEUSD_ADDRESS,
  abi: TFAKEUSD_ABI,
});

// Escrow contract (if deployed)
const escrowContract = ESCROW_ADDRESS ? getContract({
  client,
  chain: sepoliaChain,
  address: ESCROW_ADDRESS,
  abi: ESCROW_ABI,
}) : null;

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const account = useActiveAccount();
  const address = account?.address;
  const isAdmin = address?.toLowerCase() === ADMIN_ADDRESS.toLowerCase();
  const [claimLoading, setClaimLoading] = useState(false);
  const [tradingBalance, setTradingBalance] = useState<number>(0);

  // Read on-chain data for faucet - use escrow if deployed
  const { data: canClaimData, refetch: refetchCanClaim } = useReadContract(
    escrowContract ? {
      contract: escrowContract,
      method: "canClaim",
      params: address ? [address] : undefined,
    } : {
      contract: tfakeusdContract,
      method: "canMint",
      params: address ? [address] : undefined,
    }
  );

  // Wallet balance (on-chain tokens)
  const { data: walletBalance, refetch: refetchWalletBalance } = useReadContract({
    contract: tfakeusdContract,
    method: "balanceOf",
    params: address ? [address] : undefined,
  });

  const { mutateAsync: sendTransaction, isPending: isTxPending } = useSendTransaction();

  // Fetch trading balance from Supabase
  const fetchTradingBalance = async () => {
    if (!address || !isSupabaseConfigured || !supabase) return;
    
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('wallet_address', address)
      .single();
    
    if (user) {
      const { data: balance } = await supabase
        .from('user_balances')
        .select('amount')
        .eq('user_id', user.id)
        .eq('symbol', 'FAKEUSD')
        .maybeSingle();
      
      setTradingBalance(Number(balance?.amount || 0));
    }
  };

  useEffect(() => {
    fetchTradingBalance();
    // Refresh trading balance every 5 seconds as backup
    const interval = setInterval(fetchTradingBalance, 5000);
    
    // Subscribe to realtime balance updates for instant feedback
    let subscription: ReturnType<typeof supabase.channel> | null = null;
    
    const setupRealtimeSubscription = async () => {
      if (!address || !isSupabaseConfigured || !supabase) return;
      
      // Get user ID for subscription filter
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', address)
        .single();
      
      if (user) {
        subscription = supabase
          .channel(`balance-${user.id}`)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'user_balances',
            filter: `user_id=eq.${user.id}`
          }, (payload) => {
            // Update balance immediately when it changes
            if (payload.new && 'amount' in payload.new) {
              setTradingBalance(Number(payload.new.amount) || 0);
            }
          })
          .subscribe();
      }
    };
    
    setupRealtimeSubscription();
    
    return () => {
      clearInterval(interval);
      subscription?.unsubscribe();
    };
  }, [address]);

  const canClaim = canClaimData === true;
  const formattedWalletBalance = walletBalance ? (Number(walletBalance) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0';
  const formattedTradingBalance = tradingBalance.toLocaleString(undefined, { maximumFractionDigits: 0 });

  const handleClaim = async () => {
    if (!address || !canClaim) return;
    setClaimLoading(true);

    try {
      let transaction;
      
      if (escrowContract) {
        // Use escrow's claimToTrading() - tokens go directly to trading account
        transaction = prepareContractCall({
          contract: escrowContract,
          method: "claimToTrading",
          params: [],
        });
      } else {
        // Fallback to token's claim() if escrow not deployed
        transaction = prepareContractCall({
          contract: tfakeusdContract,
          method: "claim",
          params: [],
        });
      }

      await sendTransaction(transaction);

      // Update Supabase
      if (isSupabaseConfigured && supabase) {
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('wallet_address', address)
          .single();
        
        if (user) {
          await supabase.from('users').update({ last_faucet_claim_at: new Date().toISOString() }).eq('id', user.id);
          
          const { data: currentBalance } = await supabase
            .from('user_balances')
            .select('amount')
            .eq('user_id', user.id)
            .eq('symbol', 'FAKEUSD')
            .maybeSingle();
          
          const newAmount = (Number(currentBalance?.amount || 0) + 1000);
          
          await supabase.from('user_balances').upsert({ 
            user_id: user.id, 
            symbol: 'FAKEUSD', 
            amount: newAmount
          }, { onConflict: 'user_id,symbol' });
          
          setTradingBalance(newAmount);
        }
      }

      setTimeout(() => { refetchCanClaim(); refetchWalletBalance(); }, 2000);
    } catch (err) {
      console.error("Claim failed:", err);
    } finally {
      setClaimLoading(false);
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container - Compact icon-only on desktop */}
      <aside className={clsx(
        "fixed md:static inset-y-0 left-0 z-50 bg-[#0a0a0a] border-r border-gray-800 transform transition-transform duration-200 ease-in-out md:transform-none flex flex-col",
        "w-64 md:w-16", // Full width on mobile, narrow on desktop
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-4 border-b border-gray-800 flex items-center justify-between md:hidden">
           <span className="font-bold text-lg">Menu</span>
           <button onClick={onClose} className="text-gray-400">X</button>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 md:justify-center px-4 md:px-2 py-3 rounded-lg transition-colors group relative",
                  isActive 
                    ? "bg-gray-800 text-green-400 border border-gray-700" 
                    : "text-gray-400 hover:bg-gray-900 hover:text-gray-200"
                )}
                onClick={() => onClose()}
                title={item.label}
              >
                <Icon className="w-5 h-5" />
                <span className="font-mono text-sm md:hidden">{item.label}</span>
                {/* Tooltip on desktop */}
                <span className="hidden md:block absolute left-full ml-2 px-2 py-1 bg-gray-800 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                  {item.label}
                </span>
              </Link>
            );
          })}
          
          {/* Admin Link - only for admin wallet */}
          {isAdmin && (
            <Link
              href="/admin"
              className={clsx(
                "flex items-center gap-3 md:justify-center px-4 md:px-2 py-3 rounded-lg transition-colors group relative",
                pathname === '/admin'
                  ? "bg-purple-900/50 text-purple-400 border border-purple-700" 
                  : "text-purple-400/70 hover:bg-purple-900/30 hover:text-purple-300"
              )}
              onClick={() => onClose()}
              title="Admin Panel"
            >
              <Shield className="w-5 h-5" />
              <span className="font-mono text-sm md:hidden">Admin</span>
              <span className="hidden md:block absolute left-full ml-2 px-2 py-1 bg-gray-800 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                Admin Panel
              </span>
            </Link>
          )}

          {/* Vic quote - mobile only */}
          <div className="pt-8 md:hidden">
             <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
                <div className="flex items-center gap-2 mb-2">
                   <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-[10px]">🦙</div>
                   <span className="text-xs font-bold text-purple-400">Vic Says:</span>
                </div>
                <p className="text-xs text-gray-500 italic">
                   &ldquo;Leverage is just a number. Liquidation is a lifestyle.&rdquo;
                </p>
             </div>
          </div>
        </nav>

        {/* Faucet Section */}
        <div className="p-2 border-t border-gray-800">
          {address ? (
            <div className="flex flex-col items-center gap-2">
              {/* Trading Balance display - desktop (this is what matters for trading) */}
              <div className="hidden md:block text-center">
                <div className="text-[9px] text-gray-600 uppercase flex items-center justify-center gap-1">
                  <TrendingUp className="w-3 h-3 text-green-500" />
                  Balance
                </div>
                <div className="text-xs font-mono text-green-400 font-bold">{formattedTradingBalance}</div>
              </div>
              
              {/* Faucet button */}
              <button
                onClick={handleClaim}
                disabled={!canClaim || claimLoading || isTxPending}
                className={clsx(
                  "flex items-center gap-3 md:justify-center w-full px-4 md:px-2 py-3 rounded-lg transition-all group relative",
                  canClaim && !claimLoading && !isTxPending
                    ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-900/30"
                    : "bg-gray-800 text-gray-500 cursor-not-allowed"
                )}
                title={canClaim ? "Claim 1,000 tFAKEUSD" : "Cooldown active"}
              >
                {claimLoading || isTxPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Droplets className="w-5 h-5" />
                )}
                <span className="font-mono text-sm md:hidden">
                  {canClaim ? "Claim 1k" : "Cooldown"}
                </span>
                {/* Tooltip on desktop */}
                <span className="hidden md:block absolute left-full ml-2 px-2 py-1 bg-gray-800 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                  {canClaim ? "Claim 1,000 tFAKEUSD" : "Cooldown active"}
                </span>
              </button>
              
              {/* Mobile balance - show trading balance prominently */}
              <div className="md:hidden text-xs space-y-1">
                <div className="flex items-center gap-1 text-green-400">
                  <TrendingUp className="w-3 h-3" />
                  <span className="text-gray-500">Trading:</span>
                  <span className="font-mono font-bold">{formattedTradingBalance}</span>
                </div>
                <div className="text-gray-600 text-[10px]">
                  Wallet: <span className="font-mono">{formattedWalletBalance}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-2">
              <Droplets className="w-5 h-5 mx-auto text-gray-600 mb-1" />
              <div className="text-[9px] text-gray-600 md:hidden">Connect wallet</div>
            </div>
          )}
        </div>

        <div className="p-2 border-t border-gray-800 md:hidden">
           <div className="text-xs text-gray-600 text-center font-mono">
              FakeDEX v1.0.0
           </div>
        </div>
      </aside>
    </>
  );
}
