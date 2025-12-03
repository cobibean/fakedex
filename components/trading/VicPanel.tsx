'use client';

import { motion } from 'framer-motion';

interface VicPanelProps {
  chaosLevel: number;
  symbol?: string;
  isOverride?: boolean;
  price?: number;
}

const LINES = [
  { range: [0, 20], text: 'Markets are sedated. I could take a nap on these candles.' },
  { range: [20, 50], text: 'Mild turbulence. Strap on your seatbelt but keep ordering tapas.' },
  { range: [50, 80], text: 'Liquidity is drunk, volatility is the DJ. Dance accordingly.' },
  { range: [80, 101], text: 'Full chaos. If you survive this, I\'m writing you into the lore.' },
];

function getLine(chaosLevel: number) {
  const entry = LINES.find(({ range }) => chaosLevel >= range[0] && chaosLevel < range[1]);
  return entry?.text ?? 'Chaos meter malfunctioning. Probably bullish.';
}

export function VicPanel({ chaosLevel, symbol = 'SHIT', isOverride, price }: VicPanelProps) {
  return (
    <motion.div
      className="glass-panel rounded-xl border border-gray-800 p-4 flex gap-3 items-start"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-xs font-black shadow-lg">
        VIC
      </div>
      <div className="space-y-2">
        <div>
          <p className="text-sm font-bold text-white">Vic&apos;s Terminal Rant</p>
          <p className="text-xs text-gray-400 leading-relaxed">{getLine(chaosLevel)}</p>
        </div>
        <div className="flex gap-3 text-[10px] font-mono uppercase tracking-wide text-gray-500">
          <span>{symbol} ≈ ${Number(price ?? 0).toFixed(4)}</span>
          <span>Chaos {isOverride ? 'Override' : 'Global'}: {chaosLevel}%</span>
        </div>
      </div>
    </motion.div>
  );
}


