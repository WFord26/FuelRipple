type NumericLike = number | string | null | undefined;

function toFiniteNumber(value: NumericLike): number | null {
  if (value == null) return null;
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function resolvePercentChange({
  pct,
  currentPrice,
  previousPrice,
}: {
  pct: NumericLike;
  currentPrice: NumericLike;
  previousPrice: NumericLike;
}): number | null {
  const explicitPct = toFiniteNumber(pct);
  if (explicitPct != null) return explicitPct;

  const current = toFiniteNumber(currentPrice);
  const previous = toFiniteNumber(previousPrice);

  if (current == null || previous == null || previous <= 0) {
    return null;
  }

  return ((current - previous) / previous) * 100;
}

export function toDisplayNumber(value: NumericLike): number | null {
  return toFiniteNumber(value);
}
