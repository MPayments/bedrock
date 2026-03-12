export function formatMajorAmount(amount: string | number | bigint): string {
  const normalized = String(amount).trim().replace(",", ".");
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) {
    return String(amount);
  }

  const [, signRaw = "", integerRaw = "", fractionRaw = ""] = match;
  const normalizedInteger = integerRaw.replace(/^0+(?=\d)/, "");

  let integerPart: string;
  try {
    integerPart = BigInt(
      normalizedInteger.length > 0 ? normalizedInteger : "0",
    ).toLocaleString("ru-RU");
  } catch {
    integerPart = normalizedInteger.length > 0 ? normalizedInteger : "0";
  }

  if (fractionRaw.length === 0) {
    return `${signRaw}${integerPart}`;
  }

  const fractionPart = fractionRaw.replace(/0+$/, "");
  if (fractionPart.length === 0) {
    return `${signRaw}${integerPart}`;
  }

  return `${signRaw}${integerPart},${fractionPart}`;
}

export function formatAmountByCurrency(
  amount: string | number | bigint,
  _currencyCode: string | null | undefined,
): string {
  return formatMajorAmount(amount);
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
