/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';

export function useFakeDexContracts() {
  // In V1, these just return stubbed values to simulate contract connection
  // Later, we will swap this with actual Thirdweb contract hooks
  return {
    isLoading: false,
    error: null,
    contract: null // mocked
  };
}

export function useFakeUsdContract() {
    // Mock FAKEUSD token contract interaction
    return {
        symbol: "FAKEUSD",
        balance: 1000, // Mock balance if needed locally, but we use Supabase
        isLoading: false
    };
}

export function useFakeDexSwapPreview(
    amountIn: string, 
    symbol: string, 
    currentPrice: number,
    leverage: number = 1
) {
    const [data, setData] = useState<{
        estimatedOutput: number, 
        priceImpact: number, 
        fee: number
    } | null>(null);
    
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!amountIn || !symbol) {
            setData(null);
            return;
        }

        setIsLoading(true);
        const timer = setTimeout(() => {
            const amount = parseFloat(amountIn);
            
            // Simulation Logic:
            // 1. Fee is always 0.3% (classic Uniswap V2 style)
            const fee = amount * 0.003;
            
            // 2. Output is amount / price (simplified)
            const estimatedOutput = (amount - fee) / currentPrice;
            
            // 3. Price Impact simulates slippage based on size
            // Bigger trade = more slippage. 
            // Random factor for "Chaos"
            const impact = (amount / 100000) * (1 + Math.random()); 

            setData({
                estimatedOutput,
                priceImpact: Math.min(impact, 100), // Cap at 100%
                fee
            });
            setIsLoading(false);
        }, 500); // Simulate network latency

        return () => clearTimeout(timer);
    }, [amountIn, symbol, currentPrice, leverage]);

    return { data, isLoading };
}

export function useFakeDexSwap() {
    const [isLoading, setIsLoading] = useState(false);

    const swapAsync = async ({
        symbol,
        side,
        amount,
        leverage,
        price,
    }: {
        symbol: string;
        side: 'buy' | 'sell';
        amount: number;
        leverage: number;
        price: number;
    }) => {
        setIsLoading(true);
        
        // Simulate blockchain confirmation time (2-4 seconds)
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
        
        setIsLoading(false);
        return { status: 'success', txHash: `0xFAKE${symbol}${side}${amount}${leverage}${price}` };
    };

    return { swapAsync, isLoading };
}

