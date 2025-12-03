export interface Candle {
  time: number; // Unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Helper to generate a new candle based on previous close and chaos parameters
export function generateNextCandle(
  previousClose: number,
  chaosLevel: number,
  time: number,
): Candle {
  // Chaos factor: 0.0 = calm, 1.0 = absolute mayhem
  const chaosFactor = Math.max(0, Math.min(100, chaosLevel)) / 100;

  // Volatility base: MUCH MORE REASONABLE VALUES
  // At chaos 0: 0.05% per candle (very stable, like a stablecoin)
  // At chaos 100: 2% per candle (volatile meme territory)
  // This means at chaos 50, you get ~1% volatility - survivable with leverage
  const volatility = 0.0005 + (chaosFactor * 0.0195);
  
  // Directional bias: "Up Only" narrative (slight bullish tendency)
  // At 0 chaos, moderate up trend. At 100 chaos, more random.
  const upBias = 0.0001 + (0.0003 * (1 - chaosFactor)); 

  // Random walk component (Gaussian-ish approximation using Box-Muller)
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  
  const changePercent = (z * volatility) + upBias;
  const newClose = previousClose * (1 + changePercent);
  
  // Determine High/Low based on volatility noise
  // Wicks are slightly longer than body but not crazy
  // Max wick multiplier: 1.5x at chaos 0, 3x at chaos 100
  const wickMultiplier = 1.5 + (chaosFactor * 1.5);
  const wickVolatility = volatility * wickMultiplier;
  const high = Math.max(previousClose, newClose) * (1 + Math.random() * wickVolatility);
  const low = Math.min(previousClose, newClose) * (1 - Math.random() * wickVolatility);

  // Volume is correlated with volatility + chaos
  const baseVolume = 100000;
  const volumeNoise = Math.random() * baseVolume * (1 + chaosFactor * 10);
  const volume = baseVolume + volumeNoise;

  return {
    time,
    open: previousClose,
    high,
    low,
    close: newClose,
    volume: Math.floor(volume),
  };
}

export function generateInitialHistory(
  initialPrice: number,
  chaosLevel: number,
  count: number = 100,
  intervalSeconds: number = 60
): Candle[] {
  const history: Candle[] = [];
  let currentPrice = initialPrice;
  let currentTime = Math.floor(Date.now() / 1000) - (count * intervalSeconds);

  for (let i = 0; i < count; i++) {
    const candle = generateNextCandle(currentPrice, chaosLevel, currentTime);
    history.push(candle);
    currentPrice = candle.close;
    currentTime += intervalSeconds;
  }

  return history;
}

