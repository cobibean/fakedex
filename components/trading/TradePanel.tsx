'use client';

import { useState, useEffect } from 'react';
import { useActiveAccount } from "thirdweb/react";
import { Loader2, Wallet, TrendingUp, Zap, AlertTriangle } from 'lucide-react';
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

    // Fetch user ID and balance
    useEffect(() => {
        if (!account?.address || !isSupabaseConfigured || !supabase) return;

        const fetchUserData = async () => {
            const { data: user } = await supabase
                .from('users')
                .select('id')
                .eq('wallet_address', account.address)
                .single();
            
            if (user) {
                setUserId(user.id);
                
                // Fetch balance
                const { data: balanceData } = await supabase
                    .from('user_balances')
                    .select('amount')
                    .eq('user_id', user.id)
                    .eq('symbol', 'FAKEUSD')
                    .single();
                
                setBalance(Number(balanceData?.amount || 0));
            }
        };

        fetchUserData();
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
            // Open position
            const result = await openPosition({
                userId,
                symbol,
                side,
                size: amountNum,
                leverage,
                entryPrice: currentPrice,
            });

            if (!result.success) {
                throw new Error(result.error || 'Failed to open position');
            }

            // Deduct margin from balance
            const newBalance = balance - amountNum;
            await supabase
                .from('user_balances')
                .upsert({
                    user_id: userId,
                    symbol: 'FAKEUSD',
                    amount: newBalance
                }, { onConflict: 'user_id, symbol' });

            setBalance(newBalance);
            setAmount('');
            
            if (onTradeSuccess) onTradeSuccess();

        } catch (err) {
            console.error("Trade execution failed:", err);
            alert("Trade failed. Vic ate your transaction.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass-panel rounded-xl p-6 border border-gray-800 relative overflow-hidden">
            <div className="flex items-center justify-between mb-6">
                 <h3 className="text-lg font-bold text-terminal-green flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Trade {symbol}
                 </h3>
                 <div className="flex bg-gray-900 rounded p-1 gap-1">
                    <button 
                        onClick={() => setSide('long')}
                        className={`px-3 py-1 text-xs font-bold rounded transition-colors ${side === 'long' ? 'bg-green-500 text-black' : 'text-gray-500 hover:bg-gray-800'}`}
                    >
                        LONG
                    </button>
                    <button 
                        onClick={() => setSide('short')}
                        className={`px-3 py-1 text-xs font-bold rounded transition-colors ${side === 'short' ? 'bg-red-500 text-black' : 'text-gray-500 hover:bg-gray-800'}`}
                    >
                        SHORT
                    </button>
                 </div>
            </div>

            <div className="space-y-6">
                {/* Amount Input */}
                <div className="bg-black/40 p-4 rounded-lg border border-gray-700 focus-within:border-green-500/50 transition-colors">
                    <div className="flex justify-between mb-2">
                        <label className="text-xs text-gray-500 font-mono uppercase">Margin (FAKEUSD)</label>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Wallet className="w-3 h-3" />
                            Balance: {balance.toLocaleString()}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-gray-500 font-mono">$</span>
                        <input 
                            type="number" 
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00" 
                            className="w-full bg-transparent outline-none font-mono text-2xl text-white placeholder-gray-700" 
                        />
                    </div>
                    {/* Quick amount buttons */}
                    <div className="flex gap-2 mt-2">
                        {[25, 50, 75, 100].map(pct => (
                            <button
                                key={pct}
                                onClick={() => setAmount((balance * pct / 100).toFixed(2))}
                                className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                            >
                                {pct}%
                            </button>
                        ))}
                    </div>
                </div>

                {/* Leverage Slider */}
                <div className="space-y-3">
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
                        className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
                    />
                    <div className="flex justify-between text-[10px] text-gray-600 font-mono">
                        <span>1x</span>
                        <span>25x</span>
                        <span>50x</span>
                        <span>100x</span>
                    </div>
                    {leverage >= 50 && (
                        <div className="flex items-center gap-1 text-xs text-orange-400">
                            <AlertTriangle className="w-3 h-3" />
                            <span>High leverage = high risk of liquidation</span>
                        </div>
                    )}
                </div>

                {/* Preview Details */}
                {amountNum > 0 && (
                    <div className="p-3 bg-gray-900/50 rounded border border-gray-800 space-y-2 text-xs font-mono">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Position Size</span>
                            <span className="text-white">${positionSize.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Entry Price</span>
                            <span className="text-white">${currentPrice.toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-orange-400" />
                                Liquidation Price
                            </span>
                            <span className="text-orange-400">${liquidationPrice.toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Distance to Liq.</span>
                            <span className={liqDistance < 5 ? 'text-red-400' : 'text-gray-400'}>
                                {liqDistance.toFixed(2)}%
                            </span>
                        </div>
                    </div>
                )}

                {/* Action Button */}
                <button 
                    onClick={handleTrade}
                    disabled={loading || !amount || amountNum <= 0 || amountNum > balance}
                    className={`w-full py-4 font-bold text-sm uppercase tracking-wider rounded-lg shadow-lg transition-all flex items-center justify-center gap-2
                        ${side === 'long' 
                            ? 'bg-green-600 hover:bg-green-500 text-white shadow-green-900/20' 
                            : 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/20'}
                        ${(loading || !amount || amountNum <= 0 || amountNum > balance) ? 'opacity-50 cursor-not-allowed grayscale' : ''}
                    `}
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Opening Position...
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
