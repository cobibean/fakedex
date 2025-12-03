'use client';

import { useState, useEffect } from 'react';
import { useActiveAccount, useSendTransaction, useReadContract } from "thirdweb/react";
import { getContract, prepareContractCall } from "thirdweb";
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { client, sepoliaChain } from '@/lib/thirdwebClient';
import { ESCROW_ADDRESS, ESCROW_ABI, TFAKEUSD_ADDRESS, TFAKEUSD_ABI } from '@/lib/contracts';
import { ArrowUpFromLine, Loader2, CheckCircle, ExternalLink, AlertCircle, Wallet, TrendingUp } from 'lucide-react';

// Escrow contract
const escrowContract = ESCROW_ADDRESS ? getContract({
  client,
  chain: sepoliaChain,
  address: ESCROW_ADDRESS,
  abi: ESCROW_ABI,
}) : null;

// Token contract for wallet balance
const tfakeusdContract = getContract({
  client,
  chain: sepoliaChain,
  address: TFAKEUSD_ADDRESS,
  abi: TFAKEUSD_ABI,
});

export function WithdrawPanel() {
  const account = useActiveAccount();
  const address = account?.address;
  
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tradingBalance, setTradingBalance] = useState<number>(0);

  // Wallet balance
  const { data: walletBalance, refetch: refetchWalletBalance } = useReadContract({
    contract: tfakeusdContract,
    method: "balanceOf",
    params: [address ?? "0x0000000000000000000000000000000000000000"],
    queryOptions: { enabled: !!address },
  });

  // Current nonce for withdrawals
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: currentNonce, refetch: refetchNonce } = useReadContract(
    escrowContract ? {
      contract: escrowContract,
      method: "withdrawalNonces",
      params: [address ?? "0x0000000000000000000000000000000000000000"],
      queryOptions: { enabled: !!address },
    } : { contract: tfakeusdContract, method: "balanceOf", params: [address ?? "0x0000000000000000000000000000000000000000"], queryOptions: { enabled: false } } as any
  );

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
  }, [address]);

  const formattedWalletBalance = walletBalance 
    ? (Number(walletBalance) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 })
    : '0';
  
  const formattedTradingBalance = tradingBalance.toLocaleString(undefined, { maximumFractionDigits: 2 });

  const handleWithdraw = async () => {
    if (!address || !amount || !escrowContract) return;
    
    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      setError('Invalid amount');
      return;
    }
    
    if (withdrawAmount > tradingBalance) {
      setError('Insufficient trading balance');
      return;
    }
    
    setLoading(true);
    setError(null);
    setTxHash(null);

    try {
      // Get signature from backend API
      const nonce = currentNonce ? Number(currentNonce) : 0;
      const amountWei = BigInt(Math.floor(withdrawAmount * 1e18));
      
      const response = await fetch('/api/withdraw/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          amount: amountWei.toString(),
          nonce,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get withdrawal signature');
      }
      
      const { signature } = await response.json();

      // Call withdraw on escrow contract
      const transaction = prepareContractCall({
        contract: escrowContract,
        method: "withdraw",
        params: [amountWei, BigInt(nonce), signature as `0x${string}`],
      });

      const result = await sendTransaction(transaction);
      setTxHash(result.transactionHash);

      // Update Supabase trading balance
      if (isSupabaseConfigured && supabase) {
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('wallet_address', address)
          .single();
        
        if (user) {
          const newBalance = tradingBalance - withdrawAmount;
          
          await supabase
            .from('user_balances')
            .upsert({ 
              user_id: user.id, 
              symbol: 'FAKEUSD', 
              amount: Math.max(0, newBalance)
            }, { onConflict: 'user_id,symbol' });
          
          setTradingBalance(Math.max(0, newBalance));
        }
      }

      // Clear form and refetch
      setAmount('');
      setTimeout(() => {
        refetchWalletBalance();
        refetchNonce();
        fetchTradingBalance();
      }, 2000);

    } catch (err: unknown) {
      console.error("Withdraw failed:", err);
      const errorMessage = err instanceof Error ? err.message : "Transaction failed";
      setError(errorMessage.includes("user rejected") 
        ? "Transaction cancelled" 
        : errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const setMaxAmount = () => {
    setAmount(tradingBalance.toString());
  };

  if (!address) {
    return (
      <div className="glass-panel rounded-xl p-4 border border-gray-800">
        <div className="text-sm text-gray-500">Connect your wallet to withdraw.</div>
      </div>
    );
  }

  if (!ESCROW_ADDRESS) {
    return (
      <div className="glass-panel rounded-xl p-4 border border-gray-800 bg-yellow-900/10">
        <div className="flex items-center gap-2 text-yellow-500">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">Escrow not deployed - withdrawals disabled</span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-xl p-4 border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-900/50 relative overflow-hidden group">
      {/* Background Glow */}
      <div className="absolute -right-10 -top-10 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
      
      <div className="relative z-10 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-900/30 rounded-lg text-purple-400">
            <ArrowUpFromLine className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-200">Withdraw to Wallet</h3>
            <p className="text-xs text-gray-500">Cash out your trading profits</p>
          </div>
        </div>

        {/* Balances Display */}
        <div className="grid grid-cols-2 gap-3 border-t border-gray-800 pt-3">
          {/* Trading Balance */}
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <div>
              <div className="text-[10px] text-gray-500 uppercase">Available</div>
              <div className="font-mono text-green-400 font-bold">{formattedTradingBalance}</div>
            </div>
          </div>
          
          {/* Wallet Balance */}
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-blue-400" />
            <div>
              <div className="text-[10px] text-gray-500 uppercase">In Wallet</div>
              <div className="font-mono text-blue-400 font-bold">{formattedWalletBalance}</div>
            </div>
          </div>
        </div>

        {/* Amount Input */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount to withdraw"
              className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={setMaxAmount}
              className="px-3 py-2 bg-gray-800 text-gray-400 rounded-lg text-xs hover:bg-gray-700 transition-colors"
            >
              MAX
            </button>
          </div>
          
          <button
            onClick={handleWithdraw}
            disabled={!amount || loading || isTxPending || parseFloat(amount) > tradingBalance}
            className={`w-full px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-2
              ${amount && !loading && !isTxPending && parseFloat(amount) <= tradingBalance
                ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/50' 
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
              }`}
          >
            {(loading || isTxPending) && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading || isTxPending ? "Withdrawing..." : "Withdraw"}
          </button>
        </div>

        {/* Success Message */}
        {txHash && (
          <div className="flex items-center gap-2 text-xs bg-green-900/20 text-green-400 p-2 rounded border border-green-500/20">
            <CheckCircle className="w-4 h-4" />
            <span>Withdrawal successful!</span>
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
      </div>
    </div>
  );
}

