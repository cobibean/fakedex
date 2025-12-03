'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { AlertTriangle, Loader2, GripVertical } from 'lucide-react';
import { TradePanel } from '@/components/trading/TradePanel';
import { PairList } from '@/components/trading/PairList';
import { Chart } from '@/components/trading/Chart';
import { OrderFeed } from '@/components/trading/OrderFeed';
import { ActivePositions } from '@/components/trading/ActivePositions';
import { XpBar } from '@/components/xp/XpBar';
import { usePairs } from '@/hooks/usePairs';
import { useChaosEngine } from '@/hooks/useChaosEngine';
import { useBotTrades } from '@/hooks/useBotTrades';
import { useXP } from '@/hooks/useXP';
import { usePositions } from '@/hooks/usePositions';

// Get initial sidebar width from localStorage or default
const getInitialSidebarWidth = () => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('pairListWidth');
    if (saved) return Math.max(150, Math.min(400, parseInt(saved)));
  }
  return 200;
};

export default function Home() {
  const { pairs, loading: pairsLoading } = usePairs();
  const { profile } = useXP();
  const { totalUnrealizedPnL, positions } = usePositions();
  const [activeSymbol, setActiveSymbol] = useState<string>();
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [bottomPanelView, setBottomPanelView] = useState<'orders' | 'positions'>('orders');
  
  // Resizable sidebar state
  const [sidebarWidth, setSidebarWidth] = useState(200);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Load saved width on mount
  useEffect(() => {
    setSidebarWidth(getInitialSidebarWidth());
  }, []);

  // Handle resize
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = e.clientX - (sidebarRef.current?.getBoundingClientRect().left || 0);
      const clampedWidth = Math.max(150, Math.min(400, newWidth));
      setSidebarWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
        localStorage.setItem('pairListWidth', sidebarWidth.toString());
      }
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, sidebarWidth]);

  useEffect(() => {
    if (!activeSymbol && pairs.length > 0) {
      const id = setTimeout(() => setActiveSymbol(pairs[0].symbol), 0);
      return () => clearTimeout(id);
    }
  }, [pairs, activeSymbol]);

  const currentPair = useMemo(
    () => pairs.find((pair) => pair.symbol === activeSymbol),
    [pairs, activeSymbol]
  );

  const { candles, currentPrice, chaosLevel, isOverride } = useChaosEngine({
    symbol: activeSymbol || pairs[0]?.symbol || 'SHIT',
    initialPrice: currentPair?.initial_price || 1,
    intervalMs: 1200,
    isLeader: true,
  });

  useBotTrades(pairs, true);

  // Show notification
  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'warning') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  // Check for liquidations
  useEffect(() => {
    const liquidatable = positions.filter(p => p.isLiquidatable);
    if (liquidatable.length > 0) {
      showNotification(`⚠️ ${liquidatable.length} position(s) at risk of liquidation!`, 'warning');
    }
  }, [positions, showNotification]);

  const handlePositionClosed = useCallback(() => {
    showNotification('Position closed successfully!', 'success');
  }, [showNotification]);

  const handleTradeSuccess = useCallback(() => {
    showNotification('Position opened!', 'success');
  }, [showNotification]);

  if (pairsLoading && !pairs.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 text-green-500 animate-spin" />
        <p className="text-sm text-gray-500 font-mono">Loading degen markets…</p>
      </div>
    );
  }

  if (!activeSymbol) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 font-mono">
        Unable to load markets. Check Supabase or fallback data.
      </div>
    );
  }

  const isPnLPositive = totalUnrealizedPnL >= 0;

  return (
    <>
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border backdrop-blur-sm animate-slide-in ${
          notification.type === 'success' 
            ? 'bg-green-500/20 border-green-500/50 text-green-400'
            : notification.type === 'error'
              ? 'bg-red-500/20 border-red-500/50 text-red-400'
              : 'bg-orange-500/20 border-orange-500/50 text-orange-400'
        }`}>
          <p className="font-mono text-sm">{notification.message}</p>
        </div>
      )}

      <div className="flex gap-3 h-[calc(100vh-70px)]">
        {/* Resizable Pair List Panel */}
        <div 
          ref={sidebarRef}
          className="hidden lg:flex flex-shrink-0 relative"
          style={{ width: sidebarWidth }}
        >
          <div className="flex-1 glass-panel rounded-xl border border-gray-800 overflow-hidden">
            <PairList pairs={pairs} selectedSymbol={activeSymbol} onSelectPair={setActiveSymbol} />
          </div>
          
          {/* Resize Handle */}
          <div
            onMouseDown={startResizing}
            className={`absolute right-0 top-0 bottom-0 w-3 cursor-col-resize group flex items-center justify-center z-10 transition-colors ${
              isResizing ? 'bg-green-500/20' : 'hover:bg-gray-700/30'
            }`}
            style={{ transform: 'translateX(50%)' }}
          >
            <div className={`flex flex-col items-center justify-center gap-0.5 transition-opacity ${
              isResizing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}>
              <GripVertical className={`w-3 h-3 ${isResizing ? 'text-green-400' : 'text-gray-500'}`} />
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-3 h-full overflow-hidden min-w-0">
          {/* Chart Section */}
          <div className="flex-[2] glass-panel rounded-xl p-3 border border-gray-800 flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-1 px-1">
              <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
                {activeSymbol} <span className="text-gray-500 text-xs">/ FAKEUSD</span>
              </h2>
              <div className="flex items-center gap-2">
                <div className="font-mono text-lg text-green-400">${currentPrice.toFixed(5)}</div>
                <Link
                  href={`/pair/${activeSymbol}`}
                  className="text-[10px] font-mono uppercase tracking-wide border border-gray-700 px-2 py-0.5 rounded-full text-gray-400 hover:text-white hover:border-green-500 transition-colors"
                >
                  Terminal
                </Link>
              </div>
            </div>
            <div className="flex-1 w-full relative">
              <div className="absolute inset-0">
                {candles.length > 0 ? (
                  <Chart data={candles} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                    Loading chart data...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Order Feed / Positions Toggle */}
          <div className="flex-1 glass-panel rounded-xl p-3 border border-gray-800 min-h-0 max-h-[200px] flex flex-col">
            {/* Toggle Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex bg-gray-900 rounded p-0.5 gap-0.5">
                <button 
                  onClick={() => setBottomPanelView('orders')}
                  className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
                    bottomPanelView === 'orders' 
                      ? 'bg-gray-700 text-white' 
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Orders
                </button>
                <button 
                  onClick={() => setBottomPanelView('positions')}
                  className={`px-3 py-1 text-xs font-bold rounded transition-colors flex items-center gap-1.5 ${
                    bottomPanelView === 'positions' 
                      ? 'bg-gray-700 text-white' 
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Positions
                  {positions.length > 0 && (
                    <span className="bg-green-500 text-black text-[10px] px-1.5 rounded-full font-bold">
                      {positions.length}
                    </span>
                  )}
                </button>
              </div>
              {bottomPanelView === 'positions' && positions.length > 0 && (
                <div className={`text-xs font-mono font-bold ${isPnLPositive ? 'text-green-400' : 'text-red-400'}`}>
                  PnL: {isPnLPositive ? '+' : ''}${totalUnrealizedPnL.toFixed(2)}
                </div>
              )}
              {bottomPanelView === 'orders' && (
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Realtime</span>
              )}
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-hidden">
              {bottomPanelView === 'orders' ? (
                <OrderFeed activeSymbol={activeSymbol} />
              ) : (
                <ActivePositions onPositionClosed={handlePositionClosed} inline />
              )}
            </div>
          </div>
        </div>

        <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 flex flex-col gap-2 h-full overflow-y-auto scrollbar-hide pb-4">
          <TradePanel symbol={activeSymbol} currentPrice={currentPrice} onTradeSuccess={handleTradeSuccess} />

          {/* Chaos & XP Row - Side by Side */}
          <div className="grid grid-cols-2 gap-2">
            {/* Chaos Level - Compact */}
            <div className="glass-panel rounded-lg p-2 border border-gray-800">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] text-gray-500 uppercase">Chaos</span>
                {isOverride && <AlertTriangle className="w-2.5 h-2.5 text-orange-400" />}
              </div>
              <div className="text-lg font-mono font-bold text-purple-400">{chaosLevel}%</div>
              <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden mt-1">
                <div className="h-full bg-purple-500 transition-all duration-500" style={{ width: `${chaosLevel}%` }} />
              </div>
            </div>

            {/* XP - Compact */}
            <div className="glass-panel rounded-lg p-2 border border-gray-800">
              <div className="text-[10px] text-gray-500 uppercase mb-1">Level</div>
              <div className="text-lg font-mono font-bold text-yellow-400">
                {profile?.level || 1}
              </div>
              <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden mt-1">
                <div 
                  className="h-full bg-yellow-500 transition-all duration-500" 
                  style={{ width: `${((profile?.xp || 0) % 100)}%` }} 
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
