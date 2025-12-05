'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { 
  createChart, 
  ColorType, 
  IChartApi, 
  ISeriesApi, 
  CandlestickData, 
  UTCTimestamp, 
  CandlestickSeries,
  CrosshairMode,
  LineStyle,
} from 'lightweight-charts';
import { Candle } from '@/lib/chaosEngine';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2,
  RotateCcw,
  Loader2,
} from 'lucide-react';

// Position type for chart display
interface ChartPosition {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  entry_price: number;
  liquidation_price: number;
  size_fakeusd: number;
  leverage: number;
  unrealizedPnL?: number;
  pnlPercent?: number;
}

// Timeframe configuration
export interface TimeframeConfig {
  label: string;
  seconds: number;
  isAggregated: boolean; // true = fetch from candles_aggregated, false = aggregate client-side
  dbTimeframe?: string; // for aggregated timeframes: '1m', '5m', '15m', '1h', '4h', '1d'
}

interface ChartProps {
  data: Candle[]; // Base 1-second candles from chaos engine (for short timeframes)
  aggregatedData?: Candle[]; // Pre-aggregated candles (for longer timeframes)
  aggregatedLoading?: boolean; // Loading state for aggregated data
  positions?: ChartPosition[];
  currentPrice?: number;
  symbol?: string;
  selectedTimeframe?: TimeframeConfig;
  onTimeframeChange?: (tf: TimeframeConfig) => void;
  colors?: {
    backgroundColor?: string;
    textColor?: string;
  };
}

// All available timeframes - short ones use client-side aggregation, longer ones use pre-aggregated data
export const TIMEFRAMES: TimeframeConfig[] = [
  { label: '1s', seconds: 1, isAggregated: false },
  { label: '5s', seconds: 5, isAggregated: false },
  { label: '15s', seconds: 15, isAggregated: false },
  { label: '30s', seconds: 30, isAggregated: false },
  { label: '1m', seconds: 60, isAggregated: true, dbTimeframe: '1m' },
  { label: '5m', seconds: 300, isAggregated: true, dbTimeframe: '5m' },
  { label: '15m', seconds: 900, isAggregated: true, dbTimeframe: '15m' },
  { label: '1h', seconds: 3600, isAggregated: true, dbTimeframe: '1h' },
  { label: '4h', seconds: 14400, isAggregated: true, dbTimeframe: '4h' },
  { label: '1d', seconds: 86400, isAggregated: true, dbTimeframe: '1d' },
];

/**
 * Aggregate base candles into larger timeframe candles
 * e.g., 5 one-second candles become 1 five-second candle
 */
function aggregateCandles(baseCandles: Candle[], timeframeSeconds: number): Candle[] {
  if (timeframeSeconds <= 1 || baseCandles.length === 0) {
    return baseCandles;
  }

  const aggregated: Candle[] = [];
  
  // Group candles by timeframe bucket
  let currentBucket: Candle[] = [];
  let bucketStartTime = Math.floor(baseCandles[0].time / timeframeSeconds) * timeframeSeconds;

  for (const candle of baseCandles) {
    const candleBucket = Math.floor(candle.time / timeframeSeconds) * timeframeSeconds;
    
    if (candleBucket !== bucketStartTime && currentBucket.length > 0) {
      // Finish current bucket and create aggregated candle
      aggregated.push(createAggregatedCandle(currentBucket, bucketStartTime));
      currentBucket = [];
      bucketStartTime = candleBucket;
    }
    
    currentBucket.push(candle);
  }

  // Don't forget the last bucket
  if (currentBucket.length > 0) {
    aggregated.push(createAggregatedCandle(currentBucket, bucketStartTime));
  }

  return aggregated;
}

/**
 * Create a single aggregated candle from multiple base candles
 */
function createAggregatedCandle(candles: Candle[], time: number): Candle {
  const open = candles[0].open;
  const close = candles[candles.length - 1].close;
  const high = Math.max(...candles.map(c => c.high));
  const low = Math.min(...candles.map(c => c.low));
  const volume = candles.reduce((sum, c) => sum + c.volume, 0);

  return { time, open, high, low, close, volume };
}

export function Chart({ 
  data, 
  aggregatedData: externalAggregatedData,
  aggregatedLoading = false,
  positions = [],
  currentPrice = 0,
  symbol,
  selectedTimeframe: externalTimeframe,
  onTimeframeChange,
  colors: {
    backgroundColor = 'transparent',
    textColor = '#D9D9D9',
  } = {} 
}: ChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const isInitializedRef = useRef(false);
  const lastDataLengthRef = useRef(0);
  const positionLinesRef = useRef<Map<string, { entry: ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']>; liquidation: ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']> }>>(new Map());
  // Track if user has manually scrolled away from the right edge - if so, don't auto-scroll
  const userScrolledAwayRef = useRef(false);
  const isUpdatingDataRef = useRef(false); // Prevent scroll detection during data updates
  
  // Use external timeframe if provided, otherwise manage internally
  const [internalTimeframe, setInternalTimeframe] = useState(TIMEFRAMES[0]);
  const selectedTimeframe = externalTimeframe || internalTimeframe;

  // Determine which data to display based on timeframe
  const displayData = useMemo(() => {
    if (selectedTimeframe.isAggregated) {
      // For aggregated timeframes, use pre-aggregated data if available
      return externalAggregatedData || [];
    } else {
      // For short timeframes, aggregate from raw 1-second candles client-side
      return aggregateCandles(data, selectedTimeframe.seconds);
    }
  }, [data, externalAggregatedData, selectedTimeframe]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    if (container.clientWidth === 0 || container.clientHeight === 0) {
      const timeoutId = setTimeout(() => {
        if (container.clientWidth > 0) {
          chartRef.current = null;
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }

    try {
      const chart = createChart(container, {
        layout: {
          background: { type: ColorType.Solid, color: backgroundColor },
          textColor,
        },
        width: container.clientWidth,
        height: container.clientHeight || 400,
        grid: {
          vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
          horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            color: '#758696',
            width: 1,
            style: LineStyle.Dashed,
            labelBackgroundColor: '#1f2937',
          },
          horzLine: {
            color: '#758696',
            width: 1,
            style: LineStyle.Dashed,
            labelBackgroundColor: '#1f2937',
          },
        },
        timeScale: {
          borderColor: '#485c7b',
          timeVisible: true,
          secondsVisible: true,
          rightOffset: 5,
          barSpacing: 8,
          minBarSpacing: 2,
          fixLeftEdge: false,
          fixRightEdge: false,
          lockVisibleTimeRangeOnResize: true,
        },
        rightPriceScale: {
          borderColor: '#485c7b',
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: true,
        },
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true,
        },
      });

      chartRef.current = chart;

      const seriesOptions = {
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
        priceFormat: {
          type: 'price' as const,
          precision: 5,
          minMove: 0.00001,
        },
      };

      seriesRef.current = chart.addSeries(CandlestickSeries, seriesOptions);

      // ResizeObserver for responsiveness
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target === container && chartRef.current) {
            chartRef.current.applyOptions({ 
              width: entry.contentRect.width,
              height: entry.contentRect.height || 400,
            });
          }
        }
      });

      resizeObserver.observe(container);
      isInitializedRef.current = false;
      userScrolledAwayRef.current = false;

      // Detect when user manually scrolls/pans the chart
      // ANY user interaction with the time scale disables auto-scroll
      chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
        // Skip if we're programmatically updating data
        if (isUpdatingDataRef.current) return;
        
        // User is interacting with the chart - disable auto-scroll
        // They can re-enable it by clicking "Fit Content" or "Reset View"
        userScrolledAwayRef.current = true;
      });

      return () => {
        resizeObserver.disconnect();
        chart.remove();
        positionLinesRef.current.clear();
      };
    } catch (error) {
      console.error('Failed to create chart:', error);
      return () => {};
    }
  }, [backgroundColor, textColor]);

  // Update chart data with display candles (either client-aggregated or pre-aggregated)
  useEffect(() => {
    if (seriesRef.current && displayData.length > 0) {
      // Mark that we're updating data to prevent scroll detection from triggering
      isUpdatingDataRef.current = true;
      
      const formattedData: CandlestickData[] = displayData.map((d) => ({
        time: d.time as UTCTimestamp,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));

      seriesRef.current.setData(formattedData);

      // Only fit content on initial load, not on every update
      if (!isInitializedRef.current && chartRef.current) {
        chartRef.current.timeScale().fitContent();
        isInitializedRef.current = true;
        userScrolledAwayRef.current = false; // Reset scroll state on initial load
      }
      
      // Only auto-scroll if user hasn't manually scrolled away from right edge
      if (displayData.length > lastDataLengthRef.current && 
          isInitializedRef.current && 
          chartRef.current && 
          !userScrolledAwayRef.current) {
        const timeScale = chartRef.current.timeScale();
        timeScale.scrollToPosition(0, false);
      }
      
      lastDataLengthRef.current = displayData.length;
      
      // Reset the flag after a short delay to allow the scroll event to settle
      setTimeout(() => {
        isUpdatingDataRef.current = false;
      }, 50);
    }
  }, [displayData]);

  // Update position lines on chart
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;

    const series = seriesRef.current;
    const currentPositionIds = new Set(positions.filter(p => !symbol || p.symbol === symbol).map(p => p.id));
    
    // Remove lines for positions that no longer exist
    positionLinesRef.current.forEach((lines, posId) => {
      if (!currentPositionIds.has(posId)) {
        try {
          series.removePriceLine(lines.entry);
          series.removePriceLine(lines.liquidation);
        } catch {
          // Line might already be removed
        }
        positionLinesRef.current.delete(posId);
      }
    });

    // Add/update lines for current positions
    positions.filter(p => !symbol || p.symbol === symbol).forEach(position => {
      const isLong = position.side === 'long';
      const pnl = position.unrealizedPnL || 0;
      const pnlPercent = position.pnlPercent || 0;
      const isProfitable = pnl >= 0;
      
      // Format P&L for display
      const pnlText = `${isProfitable ? '+' : ''}$${pnl.toFixed(2)} (${isProfitable ? '+' : ''}${pnlPercent.toFixed(1)}%)`;
      const entryTitle = `${isLong ? '▲ LONG' : '▼ SHORT'} ${position.leverage}x | ${pnlText}`;
      const liqTitle = `☠ LIQ`;
      
      if (positionLinesRef.current.has(position.id)) {
        // Update existing lines
        const lines = positionLinesRef.current.get(position.id)!;
        try {
          series.removePriceLine(lines.entry);
          series.removePriceLine(lines.liquidation);
        } catch {
          // Line might already be removed
        }
      }
      
      // Create entry price line
      const entryLine = series.createPriceLine({
        price: position.entry_price,
        color: isLong ? '#22c55e' : '#ef4444',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: entryTitle,
      });
      
      // Create liquidation price line
      const liqLine = series.createPriceLine({
        price: position.liquidation_price,
        color: '#f97316',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: liqTitle,
      });
      
      positionLinesRef.current.set(position.id, { entry: entryLine, liquidation: liqLine });
    });
  }, [positions, symbol, currentPrice]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (!chartRef.current) return;
    const timeScale = chartRef.current.timeScale();
    const currentBarSpacing = timeScale.options().barSpacing;
    timeScale.applyOptions({ barSpacing: Math.min(currentBarSpacing * 1.5, 50) });
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!chartRef.current) return;
    const timeScale = chartRef.current.timeScale();
    const currentBarSpacing = timeScale.options().barSpacing;
    timeScale.applyOptions({ barSpacing: Math.max(currentBarSpacing / 1.5, 1) });
  }, []);

  const handleFitContent = useCallback(() => {
    if (!chartRef.current) return;
    chartRef.current.timeScale().fitContent();
    // Reset scroll state so auto-follow resumes
    userScrolledAwayRef.current = false;
  }, []);

  const handleReset = useCallback(() => {
    if (!chartRef.current) return;
    chartRef.current.timeScale().fitContent();
    chartRef.current.timeScale().applyOptions({ barSpacing: 8 });
    // Reset scroll state so auto-follow resumes
    userScrolledAwayRef.current = false;
  }, []);

  // Handle timeframe change
  const handleTimeframeChange = useCallback((tf: TimeframeConfig) => {
    // Reset view state so chart refits on timeframe change
    isInitializedRef.current = false;
    lastDataLengthRef.current = 0;
    userScrolledAwayRef.current = false; // Reset scroll state on timeframe change
    
    // Use external callback if provided, otherwise manage internally
    if (onTimeframeChange) {
      onTimeframeChange(tf);
    } else {
      setInternalTimeframe(tf);
    }
  }, [onTimeframeChange]);

  // Check if we're waiting for aggregated data
  const isWaitingForData = selectedTimeframe.isAggregated && (aggregatedLoading || displayData.length === 0);

  return (
    <div className="w-full h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-gray-900/80 border-b border-gray-800">
        {/* Timeframes - split into two rows on mobile for better UX */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-gray-500 uppercase mr-1">TF:</span>
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.label}
              onClick={() => handleTimeframeChange(tf)}
              className={`px-2 py-1 text-xs font-mono rounded transition-colors ${
                selectedTimeframe.label === tf.label
                  ? 'bg-green-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          {aggregatedLoading && (
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin mr-1" />
          )}
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleFitContent}
            className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
            title="Fit Content"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleReset}
            className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
            title="Reset View"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Chart Container */}
      <div className="flex-1 w-full bg-gray-900 rounded-b relative" style={{ minHeight: '300px' }}>
        <div
          ref={chartContainerRef}
          className="w-full h-full"
        />
        
        {/* Loading/Empty state overlay for aggregated timeframes */}
        {isWaitingForData && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
            <div className="text-center">
              {aggregatedLoading ? (
                <>
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">Loading {selectedTimeframe.label} candles...</p>
                </>
              ) : (
                <>
                  <p className="text-gray-400 text-sm mb-1">No {selectedTimeframe.label} data available yet</p>
                  <p className="text-gray-500 text-xs">Historical data will appear after the aggregator runs</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}