export function hashString(input: string, seed = 0): number {
  let hash = seed;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function pseudoRandomFromHash(hash: number, min = 0, max = 1) {
  if (max <= min) return min;
  const normalized = (hash % 1000) / 1000;
  return min + normalized * (max - min);
}

export function formatDistanceToNow(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Smart price formatter that handles very small numbers (like DEGEN at 0.0000001)
 * and normal prices appropriately
 */
export function formatPrice(price: number): string {
  if (price === 0 || isNaN(price)) return '0.00000';
  if (price >= 0.01) return price.toFixed(5);
  if (price >= 0.00001) return price.toFixed(7);
  // For very small prices, show significant digits
  const str = price.toFixed(12);
  // Find first non-zero digit after decimal and show 4 more digits
  const match = str.match(/^0\.(0*)([1-9]\d{0,3})/);
  if (match) {
    return `0.${match[1]}${match[2]}`;
  }
  return price.toExponential(2);
}

