'use client';

import { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, UTCTimestamp, CandlestickSeries } from 'lightweight-charts';
import { Candle } from '@/lib/chaosEngine';

interface ChartProps {
  data: Candle[];
  colors?: {
    backgroundColor?: string;
    lineColor?: string;
    textColor?: string;
    areaTopColor?: string;
    areaBottomColor?: string;
  };
}

export function Chart({ data, colors: {
  backgroundColor = 'transparent',
  textColor = '#D9D9D9',
} = {} }: ChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Ensure container has dimensions before creating chart
    const container = chartContainerRef.current;
    if (container.clientWidth === 0 || container.clientHeight === 0) {
      // Wait for next tick when container should be sized
      const timeoutId = setTimeout(() => {
        if (container.clientWidth > 0) {
          // Force re-run of this effect
          chartRef.current = null;
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }

    const handleResize = () => {
      if (chartRef.current && container) {
        chartRef.current.applyOptions({ width: container.clientWidth });
      }
    };

    try {
      const chart = createChart(container, {
        layout: {
          background: { type: ColorType.Solid, color: backgroundColor },
          textColor,
        },
        width: container.clientWidth,
        height: 400,
        grid: {
          vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
          horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
        },
        timeScale: {
          borderColor: '#485c7b',
          timeVisible: true,
        },
      });

      chartRef.current = chart;

      const seriesOptions = {
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      };

      // Use the v5 API: chart.addSeries(CandlestickSeries, options)
      seriesRef.current = chart.addSeries(CandlestickSeries, seriesOptions);

      // Use ResizeObserver for better responsiveness
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target === container && chartRef.current) {
            chartRef.current.applyOptions({ width: entry.contentRect.width });
          }
        }
      });

      resizeObserver.observe(container);

      return () => {
        resizeObserver.disconnect();
        chart.remove();
      };
    } catch (error) {
      console.error('Failed to create chart:', error);
      return () => {}; // Return empty cleanup function
    }
  }, [backgroundColor, textColor]);

  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      const formattedData: CandlestickData[] = data.map((d) => ({
        time: d.time as UTCTimestamp,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));

      seriesRef.current.setData(formattedData);

      // Make sure the chart fits the content
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    }
  }, [data]);

  return (
    <div
      ref={chartContainerRef}
      className="w-full h-full min-h-[400px] bg-gray-900 rounded"
      style={{ minHeight: '400px', position: 'relative' }}
    />
  );
}

