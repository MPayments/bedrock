function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function extractCrmPricingFingerprintSnapshot(
  pricingTrace: Record<string, unknown>,
) {
  const metadata = readRecord(pricingTrace.metadata);
  const snapshot = readRecord(metadata?.crmPricingSnapshot);
  if (!snapshot) {
    return null;
  }

  const clientSide = readRecord(snapshot.clientSide);
  const executionSide = readRecord(snapshot.executionSide);
  const pnl = readRecord(snapshot.pnl);
  if (!clientSide || !executionSide || !pnl) {
    return null;
  }

  return {
    clientSide,
    executionSide,
    pnl,
  };
}
