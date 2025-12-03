'use client';

import { useState, useEffect } from 'react';
import { useActiveAccount, useSendTransaction, useReadContract } from "thirdweb/react";
import { getContract, prepareContractCall } from "thirdweb";
import { client, sepoliaChain } from '@/lib/thirdwebClient';
import { ESCROW_ADDRESS, ESCROW_ABI, TFAKEUSD_ADDRESS } from '@/lib/contracts';
import { Shield, Settings, Droplets, AlertTriangle, Wallet, Check, Loader2, ExternalLink, Lock, Flame, Zap } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

// Admin wallet address
const ADMIN_ADDRESS = "0x5d92A2486042Dd4cEE0BD6B5ffd98a8C3A6EA4Fe";

// Escrow contract
const escrowContract = ESCROW_ADDRESS ? getContract({
  client,
  chain: sepoliaChain,
  address: ESCROW_ADDRESS,
  abi: ESCROW_ABI,
}) : null;

export default function AdminPage() {
  const account = useActiveAccount();
  const address = account?.address;
  const isAdmin = address?.toLowerCase() === ADMIN_ADDRESS.toLowerCase();

  const [loading, setLoading] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [maxPerTx, setMaxPerTx] = useState('');
  const [dailyLimit, setDailyLimit] = useState('');
  const [faucetAmount, setFaucetAmount] = useState('');
  const [faucetCooldown, setFaucetCooldown] = useState('');
  const [newSigner, setNewSigner] = useState('');
  const [emergencyTo, setEmergencyTo] = useState('');
  const [emergencyAmount, setEmergencyAmount] = useState('');
  
  // Chaos engine state
  const [globalChaos, setGlobalChaos] = useState<number>(50);
  const [chaosSlider, setChaosSlider] = useState<number>(50);
  const [chaosUpdating, setChaosUpdating] = useState(false);

  // Read current contract state
  const { data: currentMaxPerTx } = useReadContract(escrowContract ? {
    contract: escrowContract,
    method: "maxWithdrawalPerTx",
  } : undefined);

  const { data: currentDailyLimit } = useReadContract(escrowContract ? {
    contract: escrowContract,
    method: "dailyWithdrawalLimit",
  } : undefined);

  const { data: currentFaucetAmount } = useReadContract(escrowContract ? {
    contract: escrowContract,
    method: "faucetAmount",
  } : undefined);

  const { data: currentFaucetCooldown } = useReadContract(escrowContract ? {
    contract: escrowContract,
    method: "faucetCooldown",
  } : undefined);

  const { data: currentBackendSigner } = useReadContract(escrowContract ? {
    contract: escrowContract,
    method: "backendSigner",
  } : undefined);

  const { data: escrowBalance } = useReadContract(escrowContract ? {
    contract: escrowContract,
    method: "escrowBalance",
  } : undefined);

  const { data: totalDeposited } = useReadContract(escrowContract ? {
    contract: escrowContract,
    method: "totalDeposited",
  } : undefined);

  const { data: totalWithdrawn } = useReadContract(escrowContract ? {
    contract: escrowContract,
    method: "totalWithdrawn",
  } : undefined);

  const { data: totalFaucetClaims } = useReadContract(escrowContract ? {
    contract: escrowContract,
    method: "totalFaucetClaims",
  } : undefined);

  const { mutateAsync: sendTransaction } = useSendTransaction();

  // Fetch current chaos level
  useEffect(() => {
    const fetchChaos = async () => {
      if (!isSupabaseConfigured || !supabase) return;
      
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'global_chaos_level')
        .single();
      
      const level = data?.value?.level ?? 50;
      setGlobalChaos(level);
      setChaosSlider(level);
    };
    
    fetchChaos();
  }, []);

  // Update chaos level handler
  const handleUpdateChaos = async () => {
    if (!isSupabaseConfigured || !supabase) return;
    
    setChaosUpdating(true);
    setError(null);
    
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ 
          key: 'global_chaos_level', 
          value: { level: chaosSlider } 
        }, { 
          onConflict: 'key' 
        });
      
      if (error) throw error;
      
      setGlobalChaos(chaosSlider);
      setSuccess(`Chaos level updated to ${chaosSlider}!`);
    } catch (err) {
      console.error('Failed to update chaos:', err);
      setError(err instanceof Error ? err.message : 'Failed to update chaos level');
    } finally {
      setChaosUpdating(false);
    }
  };

  // Format helpers
  const formatTokens = (value: bigint | undefined) => {
    if (!value) return '0';
    return (Number(value) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const formatHours = (seconds: bigint | undefined) => {
    if (!seconds) return '0';
    return (Number(seconds) / 3600).toFixed(1);
  };

  // Transaction handler
  const handleTransaction = async (
    action: string,
    method: string,
    params: unknown[]
  ) => {
    if (!escrowContract) return;
    
    setLoading(action);
    setError(null);
    setSuccess(null);

    try {
      const transaction = prepareContractCall({
        contract: escrowContract,
        method,
        params: params as [],
      });

      await sendTransaction(transaction);
      setSuccess(`${action} successful!`);
    } catch (err) {
      console.error(`${action} failed:`, err);
      setError(err instanceof Error ? err.message : 'Transaction failed');
    } finally {
      setLoading(null);
    }
  };

  // Handlers
  const handleSetWithdrawalLimits = () => {
    const maxPerTxWei = maxPerTx ? BigInt(Math.floor(parseFloat(maxPerTx) * 1e18)) : 0n;
    const dailyLimitWei = dailyLimit ? BigInt(Math.floor(parseFloat(dailyLimit) * 1e18)) : 0n;
    handleTransaction('Set Withdrawal Limits', 'setWithdrawalLimits', [maxPerTxWei, dailyLimitWei]);
  };

  const handleSetFaucetSettings = () => {
    const amountWei = faucetAmount ? BigInt(Math.floor(parseFloat(faucetAmount) * 1e18)) : 0n;
    const cooldownSeconds = faucetCooldown ? BigInt(Math.floor(parseFloat(faucetCooldown) * 3600)) : 0n;
    handleTransaction('Set Faucet Settings', 'setFaucetSettings', [amountWei, cooldownSeconds]);
  };

  const handleSetBackendSigner = () => {
    if (!newSigner) return;
    handleTransaction('Set Backend Signer', 'setBackendSigner', [newSigner]);
  };

  const handleEmergencyWithdraw = () => {
    if (!emergencyTo || !emergencyAmount) return;
    const amountWei = BigInt(Math.floor(parseFloat(emergencyAmount) * 1e18));
    handleTransaction('Emergency Withdraw', 'emergencyWithdraw', [emergencyTo, amountWei]);
  };

  // Not connected
  if (!address) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="glass-panel rounded-xl p-8 border border-gray-800 text-center max-w-md">
          <Lock className="w-16 h-16 mx-auto text-gray-600 mb-4" />
          <h1 className="text-2xl font-bold text-gray-200 mb-2">Admin Panel</h1>
          <p className="text-gray-500 mb-4">Connect your wallet to access admin controls</p>
          <p className="text-xs text-gray-600">Only authorized wallets can access this page</p>
        </div>
      </div>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="glass-panel rounded-xl p-8 border border-red-900/50 text-center max-w-md bg-red-950/20">
          <AlertTriangle className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-red-400 mb-2">Access Denied</h1>
          <p className="text-gray-400 mb-4">Your wallet is not authorized to access admin controls</p>
          <div className="text-xs text-gray-600 font-mono bg-gray-900 p-2 rounded">
            Connected: {address?.slice(0, 10)}...{address?.slice(-8)}
          </div>
        </div>
      </div>
    );
  }

  // No escrow deployed
  if (!ESCROW_ADDRESS || !escrowContract) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="glass-panel rounded-xl p-8 border border-yellow-900/50 text-center max-w-md bg-yellow-950/20">
          <AlertTriangle className="w-16 h-16 mx-auto text-yellow-500 mb-4" />
          <h1 className="text-2xl font-bold text-yellow-400 mb-2">Escrow Not Deployed</h1>
          <p className="text-gray-400">The escrow contract address is not configured</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-900/30 rounded-xl">
              <Shield className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-100">Admin Panel</h1>
              <p className="text-sm text-gray-500">Manage FakeDex Escrow Contract</p>
            </div>
          </div>
          <a
            href={`https://sepolia.etherscan.io/address/${ESCROW_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            View Contract <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* Status Messages */}
        {success && (
          <div className="flex items-center gap-2 p-3 bg-green-900/20 border border-green-500/30 rounded-lg text-green-400">
            <Check className="w-5 h-5" />
            {success}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400">
            <AlertTriangle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Escrow Balance" value={formatTokens(escrowBalance)} suffix="tFAKEUSD" />
          <StatCard label="Total Deposited" value={formatTokens(totalDeposited)} suffix="tFAKEUSD" />
          <StatCard label="Total Withdrawn" value={formatTokens(totalWithdrawn)} suffix="tFAKEUSD" />
          <StatCard label="Total Faucet Claims" value={formatTokens(totalFaucetClaims)} suffix="tFAKEUSD" />
        </div>

        {/* Chaos Engine Control - Full Width */}
        <div className="glass-panel rounded-xl p-6 border border-orange-900/30 bg-gradient-to-br from-orange-950/20 to-red-950/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-900/30 rounded-lg">
                <Flame className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-200">Chaos Engine</h2>
                <p className="text-xs text-gray-500">Control global market volatility</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-orange-400">{globalChaos}</div>
              <div className="text-xs text-gray-500">Current Level</div>
            </div>
          </div>
          
          {/* Chaos Level Descriptions */}
          <div className="grid grid-cols-5 gap-2 mb-4 text-xs">
            <div className={`text-center p-2 rounded ${chaosSlider < 20 ? 'bg-green-900/30 text-green-400' : 'text-gray-600'}`}>
              <Zap className="w-4 h-4 mx-auto mb-1" />
              <div>Calm</div>
              <div className="text-[10px]">0-19</div>
            </div>
            <div className={`text-center p-2 rounded ${chaosSlider >= 20 && chaosSlider < 40 ? 'bg-blue-900/30 text-blue-400' : 'text-gray-600'}`}>
              <Zap className="w-4 h-4 mx-auto mb-1" />
              <div>Normal</div>
              <div className="text-[10px]">20-39</div>
            </div>
            <div className={`text-center p-2 rounded ${chaosSlider >= 40 && chaosSlider < 60 ? 'bg-yellow-900/30 text-yellow-400' : 'text-gray-600'}`}>
              <Zap className="w-4 h-4 mx-auto mb-1" />
              <div>Volatile</div>
              <div className="text-[10px]">40-59</div>
            </div>
            <div className={`text-center p-2 rounded ${chaosSlider >= 60 && chaosSlider < 80 ? 'bg-orange-900/30 text-orange-400' : 'text-gray-600'}`}>
              <Zap className="w-4 h-4 mx-auto mb-1" />
              <div>Chaotic</div>
              <div className="text-[10px]">60-79</div>
            </div>
            <div className={`text-center p-2 rounded ${chaosSlider >= 80 ? 'bg-red-900/30 text-red-400' : 'text-gray-600'}`}>
              <Flame className="w-4 h-4 mx-auto mb-1" />
              <div>Mayhem</div>
              <div className="text-[10px]">80-100</div>
            </div>
          </div>
          
          {/* Slider */}
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={chaosSlider}
                onChange={(e) => setChaosSlider(Number(e.target.value))}
                className="flex-1 h-3 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                style={{
                  background: `linear-gradient(to right, 
                    #22c55e 0%, 
                    #22c55e 20%, 
                    #3b82f6 20%, 
                    #3b82f6 40%, 
                    #eab308 40%, 
                    #eab308 60%, 
                    #f97316 60%, 
                    #f97316 80%, 
                    #ef4444 80%, 
                    #ef4444 100%)`
                }}
              />
              <input
                type="number"
                min="0"
                max="100"
                value={chaosSlider}
                onChange={(e) => setChaosSlider(Math.max(0, Math.min(100, Number(e.target.value))))}
                className="w-20 bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:border-orange-500"
              />
            </div>
            
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>0.05% volatility/candle</span>
              <span>→</span>
              <span>2% volatility/candle</span>
            </div>
            
            <button
              onClick={handleUpdateChaos}
              disabled={chaosUpdating || chaosSlider === globalChaos}
              className="w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {chaosUpdating && <Loader2 className="w-4 h-4 animate-spin" />}
              {chaosSlider === globalChaos ? 'No Changes' : `Set Chaos to ${chaosSlider}`}
            </button>
          </div>
        </div>

        {/* Admin Panels */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Withdrawal Limits */}
          <div className="glass-panel rounded-xl p-6 border border-gray-800">
            <div className="flex items-center gap-3 mb-4">
              <Settings className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-bold text-gray-200">Withdrawal Limits</h2>
            </div>
            
            <div className="space-y-4">
              <div className="text-xs text-gray-500 bg-gray-900/50 p-2 rounded">
                Current: Max/Tx: {formatTokens(currentMaxPerTx) || '∞'} | Daily: {formatTokens(currentDailyLimit) || '∞'}
              </div>
              
              <div>
                <label className="block text-xs text-gray-500 mb-1">Max Per Transaction (0 = no limit)</label>
                <input
                  type="number"
                  value={maxPerTx}
                  onChange={(e) => setMaxPerTx(e.target.value)}
                  placeholder="e.g., 10000"
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-xs text-gray-500 mb-1">Daily Limit (0 = no limit)</label>
                <input
                  type="number"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(e.target.value)}
                  placeholder="e.g., 50000"
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              
              <button
                onClick={handleSetWithdrawalLimits}
                disabled={loading === 'Set Withdrawal Limits'}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading === 'Set Withdrawal Limits' && <Loader2 className="w-4 h-4 animate-spin" />}
                Update Limits
              </button>
            </div>
          </div>

          {/* Faucet Settings */}
          <div className="glass-panel rounded-xl p-6 border border-gray-800">
            <div className="flex items-center gap-3 mb-4">
              <Droplets className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-gray-200">Faucet Settings</h2>
            </div>
            
            <div className="space-y-4">
              <div className="text-xs text-gray-500 bg-gray-900/50 p-2 rounded">
                Current: {formatTokens(currentFaucetAmount)} tFAKEUSD every {formatHours(currentFaucetCooldown)}h
              </div>
              
              <div>
                <label className="block text-xs text-gray-500 mb-1">Faucet Amount (tokens)</label>
                <input
                  type="number"
                  value={faucetAmount}
                  onChange={(e) => setFaucetAmount(e.target.value)}
                  placeholder="e.g., 1000"
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>
              
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cooldown (hours)</label>
                <input
                  type="number"
                  value={faucetCooldown}
                  onChange={(e) => setFaucetCooldown(e.target.value)}
                  placeholder="e.g., 24"
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>
              
              <button
                onClick={handleSetFaucetSettings}
                disabled={loading === 'Set Faucet Settings'}
                className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading === 'Set Faucet Settings' && <Loader2 className="w-4 h-4 animate-spin" />}
                Update Faucet
              </button>
            </div>
          </div>

          {/* Backend Signer */}
          <div className="glass-panel rounded-xl p-6 border border-gray-800">
            <div className="flex items-center gap-3 mb-4">
              <Wallet className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-bold text-gray-200">Backend Signer</h2>
            </div>
            
            <div className="space-y-4">
              <div className="text-xs text-gray-500 bg-gray-900/50 p-2 rounded font-mono break-all">
                Current: {currentBackendSigner || 'Not set'}
              </div>
              
              <div>
                <label className="block text-xs text-gray-500 mb-1">New Signer Address</label>
                <input
                  type="text"
                  value={newSigner}
                  onChange={(e) => setNewSigner(e.target.value)}
                  placeholder="0x..."
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-purple-500"
                />
              </div>
              
              <button
                onClick={handleSetBackendSigner}
                disabled={loading === 'Set Backend Signer' || !newSigner}
                className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading === 'Set Backend Signer' && <Loader2 className="w-4 h-4 animate-spin" />}
                Update Signer
              </button>
            </div>
          </div>

          {/* Emergency Withdraw */}
          <div className="glass-panel rounded-xl p-6 border border-red-900/30 bg-red-950/10">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h2 className="text-lg font-bold text-red-300">Emergency Withdraw</h2>
            </div>
            
            <div className="space-y-4">
              <p className="text-xs text-gray-500">
                Use only in emergencies. Withdraws tokens from escrow to specified address.
              </p>
              
              <div>
                <label className="block text-xs text-gray-500 mb-1">Recipient Address</label>
                <input
                  type="text"
                  value={emergencyTo}
                  onChange={(e) => setEmergencyTo(e.target.value)}
                  placeholder="0x..."
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-red-500"
                />
              </div>
              
              <div>
                <label className="block text-xs text-gray-500 mb-1">Amount (tokens)</label>
                <input
                  type="number"
                  value={emergencyAmount}
                  onChange={(e) => setEmergencyAmount(e.target.value)}
                  placeholder="e.g., 1000"
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
                />
              </div>
              
              <button
                onClick={handleEmergencyWithdraw}
                disabled={loading === 'Emergency Withdraw' || !emergencyTo || !emergencyAmount}
                className="w-full py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading === 'Emergency Withdraw' && <Loader2 className="w-4 h-4 animate-spin" />}
                Emergency Withdraw
              </button>
            </div>
          </div>
        </div>

        {/* Contract Info */}
        <div className="glass-panel rounded-xl p-6 border border-gray-800">
          <h3 className="text-sm font-bold text-gray-400 mb-3">Contract Information</h3>
          <div className="grid md:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-500">Escrow Address:</span>
              <span className="ml-2 font-mono text-gray-300">{ESCROW_ADDRESS}</span>
            </div>
            <div>
              <span className="text-gray-500">Token Address:</span>
              <span className="ml-2 font-mono text-gray-300">{TFAKEUSD_ADDRESS}</span>
            </div>
            <div>
              <span className="text-gray-500">Network:</span>
              <span className="ml-2 text-gray-300">Sepolia (Chain ID: 11155111)</span>
            </div>
            <div>
              <span className="text-gray-500">Admin Wallet:</span>
              <span className="ml-2 font-mono text-gray-300">{ADMIN_ADDRESS}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="glass-panel rounded-xl p-4 border border-gray-800">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-xl font-bold text-gray-100">
        {value}
        {suffix && <span className="text-xs text-gray-500 ml-1">{suffix}</span>}
      </div>
    </div>
  );
}

