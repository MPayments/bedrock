const MONEY_LOCALE = "ru-RU";

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

export function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(MONEY_LOCALE, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    const value = new Intl.NumberFormat(MONEY_LOCALE, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

    return `${value} ${currency}`;
  }
}
