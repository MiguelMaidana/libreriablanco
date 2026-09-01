export interface MarginResult {
  profit: number;
  marginPercent: number;
}

export function calculateMargin(cost: number, price: number): MarginResult {
  const profit = Math.round((price - cost) * 100) / 100;

  if (price === 0) {
    return { profit, marginPercent: 0 };
  }

  const marginPercent = Math.round((profit / price) * 100 * 100) / 100;
  return { profit, marginPercent };
}
