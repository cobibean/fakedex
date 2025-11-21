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

  // Volatility base: 1% at 0 chaos, up to 20% at 100 chaos
  const volatility = 0.01 + (chaosFactor * 0.19);
  
  // Directional bias: "Up Only" narrative
  // At 0 chaos, strong up trend. At 100 chaos, wild but slightly less predictable trend.
  // Bias is a small percentage added to the random walk.
  const upBias = 0.001 + (0.005 * (1 - chaosFactor)); 

  // Random walk component (Gaussian-ish approximation)
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  
  const changePercent = (z * volatility) + upBias;
  const newClose = previousClose * (1 + changePercent);
  
  // Determine High/Low based on volatility noise
  // Wicks get longer with more chaos
  const wickVolatility = volatility * (1 + chaosFactor * 2);
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

