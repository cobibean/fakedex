'use client';

import { useState } from 'react';
import { useActiveAccount } from "thirdweb/react";
import { Loader2, ArrowDownUp, Wallet, TrendingUp, Zap } from 'lucide-react';
import { useFakeDexSwapPreview, useFakeDexSwap } from '@/hooks/useFakeDexContracts';
import { supabase } from '@/lib/supabaseClient';

interface TradePanelProps {
    symbol: string;
    currentPrice: number;
    onTradeSuccess?: () => void;
}

export function TradePanel({ symbol, currentPrice, onTradeSuccess }: TradePanelProps) {
    const account = useActiveAccount();
    const [amount, setAmount] = useState<string>('');
    const [leverage, setLeverage] = useState<number>(1);
    const [side, setSide] = useState<'buy' | 'sell'>('buy');
    const [loading, setLoading] = useState(false);

    // Hooks
    const { data: preview, isLoading: previewLoading } = useFakeDexSwapPreview(amount, symbol, currentPrice, leverage);
    const { swapAsync } = useFakeDexSwap();

    const handleTrade = async () => {
        if (!account?.address) {
            alert("Connect wallet to trade!");
            return;
        }
        if (!amount || parseFloat(amount) <= 0) return;

        setLoading(true);

        try {
            // 1. Simulate Contract Call
            await swapAsync({
                symbol,
                side,
                amount: parseFloat(amount),
                leverage,
                price: currentPrice
            });

            // 2. Get User ID
            const { data: user } = await supabase.from('users').select('id').eq('wallet_address', account.address).single();
            if (!user) throw new Error("User not found");

            // 3. Insert Trade into Supabase
            const { error: tradeError } = await supabase.from('trades').insert({
                user_id: user.id,
                symbol,
                side,
                size_fakeusd: parseFloat(amount) * leverage,
                price: currentPrice,
                leverage,
                is_bot: false
            });
            
            if (tradeError) throw tradeError;

            // 4. Update Mock Balances (Optimistic-ish)
            // Deduct FAKEUSD
            // Note: Real app would verify balance first. V1 assumes infinite money glitch (or relies on Faucet).
            const { data: currentBalance } = await supabase
                .from('user_balances')
                .select('amount')
                .eq('user_id', user.id)
                .eq('symbol', 'FAKEUSD')
                .single();
            
            const newUsdBalance = (Number(currentBalance?.amount || 0) - parseFloat(amount));
            
            await supabase.from('user_balances').upsert({
                 user_id: user.id,
                 symbol: 'FAKEUSD',
                 amount: newUsdBalance
            }, { onConflict: 'user_id, symbol' });

            // Add Position/Token (Simplified: just storing token balance for now, not complex positions)
            // In a real perp dex, this is a position. Here we simulate buying the token spot-ish.
            const tokenAmount = preview?.estimatedOutput || 0;
            
             const { data: tokenBalance } = await supabase
                .from('user_balances')
                .select('amount')
                .eq('user_id', user.id)
                .eq('symbol', symbol)
                .single();
                
            const newTokenBalance = (Number(tokenBalance?.amount || 0) + (side === 'buy' ? tokenAmount : -tokenAmount));

            await supabase.from('user_balances').upsert({
                 user_id: user.id,
                 symbol: symbol,
                 amount: newTokenBalance
            }, { onConflict: 'user_id, symbol' });

            alert(`Successfully ${side === 'buy' ? 'Longed' : 'Short'} ${symbol}!`);
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
                        onClick={() => setSide('buy')}
                        className={`px-3 py-1 text-xs font-bold rounded transition-colors ${side === 'buy' ? 'bg-green-500 text-black' : 'text-gray-500 hover:bg-gray-800'}`}
                    >
                        LONG
                    </button>
                    <button 
                        onClick={() => setSide('sell')}
                        className={`px-3 py-1 text-xs font-bold rounded transition-colors ${side === 'sell' ? 'bg-red-500 text-black' : 'text-gray-500 hover:bg-gray-800'}`}
                    >
                        SHORT
                    </button>
                 </div>
            </div>

            <div className="space-y-6">
                {/* Amount Input */}
                <div className="bg-black/40 p-4 rounded-lg border border-gray-700 focus-within:border-green-500/50 transition-colors">
                    <div className="flex justify-between mb-2">
                        <label className="text-xs text-gray-500 font-mono uppercase">Amount (FAKEUSD)</label>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Wallet className="w-3 h-3" />
                            Balance: 1,000
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
                </div>

                {/* Leverage Slider */}
                <div className="space-y-3">
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Leverage</span>
                        <span className="text-accent-pink font-bold">{leverage}x</span>
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
                </div>

                {/* Preview Details */}
                {amount && (
                    <div className="p-3 bg-gray-900/50 rounded border border-gray-800 space-y-2 text-xs font-mono">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Est. Output</span>
                            <span className="text-white">
                                {previewLoading ? '...' : `~${preview?.estimatedOutput.toFixed(2)} ${symbol}`}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Price Impact</span>
                            <span className={`${(preview?.priceImpact || 0) > 5 ? 'text-red-500' : 'text-green-500'}`}>
                                {previewLoading ? '...' : `${(preview?.priceImpact || 0).toFixed(2)}%`}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Entry Price</span>
                            <span className="text-white">${currentPrice.toFixed(4)}</span>
                        </div>
                    </div>
                )}

                {/* Action Button */}
                <button 
                    onClick={handleTrade}
                    disabled={loading || !amount || !account}
                    className={`w-full py-4 font-bold text-sm uppercase tracking-wider rounded-lg shadow-lg transition-all flex items-center justify-center gap-2
                        ${side === 'buy' 
                            ? 'bg-green-600 hover:bg-green-500 text-white shadow-green-900/20' 
                            : 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/20'}
                        ${(loading || !amount || !account) ? 'opacity-50 cursor-not-allowed grayscale' : ''}
                    `}
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Confirming...
                        </>
                    ) : (
                        <>
                            <Zap className="w-4 h-4 fill-current" />
                            {side === 'buy' ? 'Enter Long' : 'Enter Short'}
                        </>
                    )}
                </button>
                
                {!account && (
                     <p className="text-xs text-center text-red-400">Wallet not connected</p>
                )}
            </div>
        </div>
    );
}

