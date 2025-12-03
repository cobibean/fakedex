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

interface ChartProps {
  data: Candle[]; // Base 1-second candles from chaos engine
  positions?: ChartPosition[];
  currentPrice?: number;
  symbol?: string;
  colors?: {
    backgroundColor?: string;
    textColor?: string;
  };
}

const TIMEFRAMES = [
  { label: '1s', seconds: 1 },
  { label: '5s', seconds: 5 },
  { label: '15s', seconds: 15 },
  { label: '30s', seconds: 30 },
  { label: '1m', seconds: 60 },
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
  positions = [],
  currentPrice = 0,
  symbol,
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
  
  const [selectedTimeframe, setSelectedTimeframe] = useState(TIMEFRAMES[0]);

  // Aggregate candles based on selected timeframe
  const aggregatedData = useMemo(() => {
    return aggregateCandles(data, selectedTimeframe.seconds);
  }, [data, selectedTimeframe.seconds]);

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

  // Update chart data with aggregated candles
  useEffect(() => {
    if (seriesRef.current && aggregatedData.length > 0) {
      const formattedData: CandlestickData[] = aggregatedData.map((d) => ({
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
      }
      
      // If we have new candles and we're at the right edge, keep scrolling
      if (aggregatedData.length > lastDataLengthRef.current && isInitializedRef.current && chartRef.current) {
        const timeScale = chartRef.current.timeScale();
        const visibleRange = timeScale.getVisibleLogicalRange();
        if (visibleRange) {
          const isAtRightEdge = visibleRange.to >= lastDataLengthRef.current - 3;
          if (isAtRightEdge) {
            timeScale.scrollToPosition(0, false);
          }
        }
      }
      
      lastDataLengthRef.current = aggregatedData.length;
    }
  }, [aggregatedData]);

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
  }, []);

  const handleReset = useCallback(() => {
    if (!chartRef.current) return;
    chartRef.current.timeScale().fitContent();
    chartRef.current.timeScale().applyOptions({ barSpacing: 8 });
  }, []);

  // Handle timeframe change
  const handleTimeframeChange = useCallback((tf: typeof TIMEFRAMES[0]) => {
    setSelectedTimeframe(tf);
    // Reset view state so chart refits on timeframe change
    isInitializedRef.current = false;
    lastDataLengthRef.current = 0;
  }, []);

  return (
    <div className="w-full h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-gray-900/80 border-b border-gray-800">
        {/* Timeframes */}
        <div className="flex items-center gap-1">
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
      <div
        ref={chartContainerRef}
        className="flex-1 w-full bg-gray-900 rounded-b"
        style={{ minHeight: '300px' }}
      />
    </div>
  );
}
