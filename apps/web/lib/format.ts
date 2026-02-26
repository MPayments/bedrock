export function formatAmount(amountMinor: string | number, precision: number): string {
  const divisor = Math.pow(10, precision);
  const major = Number(amountMinor) / divisor;
  return major.toLocaleString("ru-RU", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
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
