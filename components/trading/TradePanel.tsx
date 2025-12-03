'use client';

import { useState, useEffect } from 'react';
import { useActiveAccount } from "thirdweb/react";
import { Loader2, Wallet, TrendingUp, Zap, Target, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { openPosition, calculateLiquidationPrice } from '@/lib/positionService';

interface TradePanelProps {
    symbol: string;
    currentPrice: number;
    onTradeSuccess?: () => void;
}

export function TradePanel({ symbol, currentPrice, onTradeSuccess }: TradePanelProps) {
    const account = useActiveAccount();
    const [amount, setAmount] = useState<string>('');
    const [leverage, setLeverage] = useState<number>(1);
    const [side, setSide] = useState<'long' | 'short'>('long');
    const [loading, setLoading] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [balance, setBalance] = useState<number>(0);
    
    // SL/TP state
    const [showSlTp, setShowSlTp] = useState(false);
    const [stopLoss, setStopLoss] = useState<string>('');
    const [takeProfit, setTakeProfit] = useState<string>('');

    // Fetch user ID and balance with realtime updates
    useEffect(() => {
        if (!account?.address || !isSupabaseConfigured || !supabase) return;

        // Store reference to avoid null checks
        const db = supabase;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let subscription: any = null;

        const fetchUserData = async () => {
            const { data: user } = await db
                .from('users')
                .select('id')
                .eq('wallet_address', account.address)
                .single();
            
            if (user) {
                setUserId(user.id);
                
                // Fetch balance - use maybeSingle() to handle no rows gracefully
                const { data: balanceData } = await db
                    .from('user_balances')
                    .select('amount')
                    .eq('user_id', user.id)
                    .eq('symbol', 'FAKEUSD')
                    .maybeSingle();
                
                setBalance(Number(balanceData?.amount || 0));
                
                // Subscribe to balance changes for real-time updates
                subscription = db
                    .channel(`trade-balance-${user.id}`)
                    .on('postgres_changes', {
                        event: '*',
                        schema: 'public',
                        table: 'user_balances',
                        filter: `user_id=eq.${user.id}`
                    }, (payload) => {
                        if (payload.new && 'amount' in payload.new) {
                            setBalance(Number(payload.new.amount) || 0);
                        }
                    })
                    .subscribe();
            }
        };

        fetchUserData();
        
        return () => {
            subscription?.unsubscribe();
        };
    }, [account?.address]);

    // Calculate preview values
    const amountNum = parseFloat(amount) || 0;
    const positionSize = amountNum * leverage;
    const liquidationPrice = amountNum > 0 
        ? calculateLiquidationPrice(currentPrice, leverage, side)
        : 0;
    const liqDistance = amountNum > 0
        ? Math.abs((liquidationPrice - currentPrice) / currentPrice * 100)
        : 0;

    if (!account?.address) {
        return (
            <div className="glass-panel rounded-xl p-6 border border-gray-800">
                <p className="text-sm text-center text-gray-500">Connect wallet to trade.</p>
            </div>
        );
    }

    if (!isSupabaseConfigured || !supabase) {
        return (
            <div className="glass-panel rounded-xl p-6 border border-gray-800">
                <p className="text-sm text-center text-gray-500">Configure Supabase to enable trading.</p>
            </div>
        );
    }

    // Store reference to avoid null checks in async functions
    const db = supabase;

    const handleTrade = async () => {
        if (!userId) {
            alert("User not found. Try refreshing the page.");
            return;
        }
        if (!amount || amountNum <= 0) return;
        if (amountNum > balance) {
            alert("Insufficient balance. Claim from the faucet!");
            return;
        }

        setLoading(true);

        try {
            // Open position with optional SL/TP
            const slPrice = stopLoss ? parseFloat(stopLoss) : undefined;
            const tpPrice = takeProfit ? parseFloat(takeProfit) : undefined;
            
            const result = await openPosition({
                userId,
                symbol,
                side,
                size: amountNum,
                leverage,
                entryPrice: currentPrice,
                stopLoss: slPrice,
                takeProfit: tpPrice,
            });

            if (!result.success) {
                throw new Error(result.error || 'Failed to open position');
            }

            // Deduct margin from balance
            const newBalance = balance - amountNum;
            await db
                .from('user_balances')
                .upsert({
                    user_id: userId,
                    symbol: 'FAKEUSD',
                    amount: newBalance
                }, { onConflict: 'user_id, symbol' });

            setBalance(newBalance);
            setAmount('');
            setStopLoss('');
            setTakeProfit('');
            setShowSlTp(false);
            
            if (onTradeSuccess) onTradeSuccess();

        } catch (err) {
            console.error("Trade execution failed:", err);
            alert("Trade failed. Vic ate your transaction.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass-panel rounded-xl p-4 border border-gray-800 relative overflow-hidden">
            {/* Header Row - Compact */}
            <div className="flex items-center justify-between mb-3">
                 <h3 className="text-sm font-bold text-terminal-green flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" />
                    Trade {symbol}
                 </h3>
                 <div className="flex bg-gray-900 rounded p-0.5 gap-0.5">
                    <button 
                        onClick={() => setSide('long')}
                        className={`px-2.5 py-1 text-xs font-bold rounded transition-colors ${side === 'long' ? 'bg-green-500 text-black' : 'text-gray-500 hover:bg-gray-800'}`}
                    >
                        LONG
                    </button>
                    <button 
                        onClick={() => setSide('short')}
                        className={`px-2.5 py-1 text-xs font-bold rounded transition-colors ${side === 'short' ? 'bg-red-500 text-black' : 'text-gray-500 hover:bg-gray-800'}`}
                    >
                        SHORT
                    </button>
                 </div>
            </div>

            <div className="space-y-3">
                {/* Amount Input - Compact */}
                <div className="bg-black/40 p-3 rounded-lg border border-gray-700 focus-within:border-green-500/50 transition-colors">
                    <div className="flex justify-between mb-1">
                        <label className="text-[10px] text-gray-500 font-mono uppercase">Margin</label>
                        <span className="text-[10px] text-gray-500 flex items-center gap-1">
                            <Wallet className="w-2.5 h-2.5" />
                            {balance.toLocaleString()}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-gray-500 font-mono text-sm">$</span>
                        <input 
                            type="number" 
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00" 
                            className="w-full bg-transparent outline-none font-mono text-xl text-white placeholder-gray-700" 
                        />
                    </div>
                    {/* Quick amount buttons */}
                    <div className="flex gap-1.5 mt-2">
                        {[25, 50, 75, 100].map(pct => (
                            <button
                                key={pct}
                                onClick={() => setAmount((balance * pct / 100).toFixed(2))}
                                className="flex-1 text-[10px] px-1.5 py-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                            >
                                {pct}%
                            </button>
                        ))}
                    </div>
                </div>

                {/* Leverage Slider - Compact */}
                <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Leverage</span>
                        <span className={`font-bold ${leverage >= 50 ? 'text-red-400' : leverage >= 20 ? 'text-orange-400' : 'text-purple-400'}`}>
                            {leverage}x
                        </span>
                    </div>
                    <input 
                        type="range" 
                        min="1" 
                        max="100" 
                        value={leverage} 
                        onChange={(e) => setLeverage(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
                    />
                    <div className="flex justify-between text-[9px] text-gray-600 font-mono">
                        <span>1x</span>
                        <span>25x</span>
                        <span>50x</span>
                        <span>100x</span>
                    </div>
                </div>

                {/* Stop Loss / Take Profit Toggle */}
                <div className="space-y-2">
                    <button
                        onClick={() => setShowSlTp(!showSlTp)}
                        className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-white transition-colors py-1"
                    >
                        <span className="flex items-center gap-1.5">
                            <Target className="w-3.5 h-3.5" />
                            Stop Loss / Take Profit
                        </span>
                        {showSlTp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    
                    {showSlTp && (
                        <div className="grid grid-cols-2 gap-2">
                            {/* Stop Loss */}
                            <div className="bg-black/40 p-2 rounded-lg border border-gray-700 focus-within:border-red-500/50">
                                <label className="text-[9px] text-red-400 font-mono uppercase block mb-1">Stop Loss</label>
                                <div className="flex items-center gap-1">
                                    <span className="text-gray-500 font-mono text-xs">$</span>
                                    <input 
                                        type="number" 
                                        value={stopLoss}
                                        onChange={(e) => setStopLoss(e.target.value)}
                                        placeholder={side === 'long' 
                                            ? (currentPrice * 0.95).toFixed(5) 
                                            : (currentPrice * 1.05).toFixed(5)}
                                        className="w-full bg-transparent outline-none font-mono text-sm text-white placeholder-gray-700" 
                                    />
                                </div>
                                {/* Quick SL buttons */}
                                <div className="flex gap-1 mt-1.5">
                                    {[2, 5, 10].map(pct => {
                                        const slPrice = side === 'long' 
                                            ? currentPrice * (1 - pct/100)
                                            : currentPrice * (1 + pct/100);
                                        return (
                                            <button
                                                key={pct}
                                                onClick={() => setStopLoss(slPrice.toFixed(5))}
                                                className="flex-1 text-[9px] px-1 py-0.5 bg-red-900/30 hover:bg-red-900/50 rounded text-red-400 hover:text-red-300 transition-colors"
                                            >
                                                -{pct}%
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            {/* Take Profit */}
                            <div className="bg-black/40 p-2 rounded-lg border border-gray-700 focus-within:border-green-500/50">
                                <label className="text-[9px] text-green-400 font-mono uppercase block mb-1">Take Profit</label>
                                <div className="flex items-center gap-1">
                                    <span className="text-gray-500 font-mono text-xs">$</span>
                                    <input 
                                        type="number" 
                                        value={takeProfit}
                                        onChange={(e) => setTakeProfit(e.target.value)}
                                        placeholder={side === 'long' 
                                            ? (currentPrice * 1.10).toFixed(5) 
                                            : (currentPrice * 0.90).toFixed(5)}
                                        className="w-full bg-transparent outline-none font-mono text-sm text-white placeholder-gray-700" 
                                    />
                                </div>
                                {/* Quick TP buttons */}
                                <div className="flex gap-1 mt-1.5">
                                    {[5, 10, 25].map(pct => {
                                        const tpPrice = side === 'long' 
                                            ? currentPrice * (1 + pct/100)
                                            : currentPrice * (1 - pct/100);
                                        return (
                                            <button
                                                key={pct}
                                                onClick={() => setTakeProfit(tpPrice.toFixed(5))}
                                                className="flex-1 text-[9px] px-1 py-0.5 bg-green-900/30 hover:bg-green-900/50 rounded text-green-400 hover:text-green-300 transition-colors"
                                            >
                                                +{pct}%
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Preview Details - Compact */}
                {amountNum > 0 && (
                    <div className="p-2 bg-gray-900/50 rounded border border-gray-800 space-y-1 text-[11px] font-mono">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Size</span>
                            <span className="text-white">${positionSize.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Entry</span>
                            <span className="text-white">${currentPrice.toFixed(5)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Liq. Price</span>
                            <span className="text-orange-400">${liquidationPrice.toFixed(5)} ({liqDistance.toFixed(1)}%)</span>
                        </div>
                        {stopLoss && (
                            <div className="flex justify-between">
                                <span className="text-gray-500">Stop Loss</span>
                                <span className="text-red-400">${parseFloat(stopLoss).toFixed(5)}</span>
                            </div>
                        )}
                        {takeProfit && (
                            <div className="flex justify-between">
                                <span className="text-gray-500">Take Profit</span>
                                <span className="text-green-400">${parseFloat(takeProfit).toFixed(5)}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Action Button - Compact */}
                <button 
                    onClick={handleTrade}
                    disabled={loading || !amount || amountNum <= 0 || amountNum > balance}
                    className={`w-full py-3 font-bold text-sm uppercase tracking-wider rounded-lg shadow-lg transition-all flex items-center justify-center gap-2
                        ${side === 'long' 
                            ? 'bg-green-600 hover:bg-green-500 text-white shadow-green-900/20' 
                            : 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/20'}
                        ${(loading || !amount || amountNum <= 0 || amountNum > balance) ? 'opacity-50 cursor-not-allowed grayscale' : ''}
                    `}
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Opening...
                        </>
                    ) : (
                        <>
                            <Zap className="w-4 h-4 fill-current" />
                            {side === 'long' ? 'Open Long' : 'Open Short'}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
