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

