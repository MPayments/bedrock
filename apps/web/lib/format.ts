export function formatAmount(amountMinor: string | number, precision: number): string {
  const normalizedPrecision = Number.isFinite(precision)
    ? Math.max(0, Math.trunc(precision))
    : 0;

  let minor: bigint;
  try {
    minor =
      typeof amountMinor === "string"
        ? BigInt(amountMinor)
        : BigInt(Math.trunc(amountMinor));
  } catch {
    return String(amountMinor);
  }

  const negative = minor < 0n;
  const absoluteMinor = negative ? -minor : minor;
  const sign = negative ? "-" : "";

  if (normalizedPrecision === 0) {
    return `${sign}${absoluteMinor.toLocaleString("ru-RU")}`;
  }

  const divisor = 10n ** BigInt(normalizedPrecision);
  const major = absoluteMinor / divisor;
  const fraction = (absoluteMinor % divisor)
    .toString()
    .padStart(normalizedPrecision, "0");

  return `${sign}${major.toLocaleString("ru-RU")},${fraction}`;
}

export function formatDate(date: Date | string | number | undefined) {
  if (!date) return "";

  const normalizedDate = new Date(date);
  if (Number.isNaN(normalizedDate.getTime())) {
    return "";
  }

  const hours = String(normalizedDate.getHours()).padStart(2, "0");
  const minutes = String(normalizedDate.getMinutes()).padStart(2, "0");
  const day = String(normalizedDate.getDate()).padStart(2, "0");
  const month = String(normalizedDate.getMonth() + 1).padStart(2, "0");
  const year = normalizedDate.getFullYear();

  return `${hours}:${minutes} ${day}.${month}.${year}`;
}
