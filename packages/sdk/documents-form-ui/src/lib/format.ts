import { minorToAmountString } from "@bedrock/shared/money";

function formatMajorAmount(amount: string | number | bigint): string {
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

function formatMinorAmount(
  amount: string | number | bigint,
  precision = 2,
): string {
  return formatMajorAmount(minorToAmountString(amount, { precision }));
}

export function formatMinorAmountWithCurrency(
  amount: string | number | bigint,
  currencyCode: string,
  precision = 2,
): string {
  return `${formatMinorAmount(amount, precision)} ${currencyCode}`;
}

export function formatAmountByCurrency(
  amount: string | number | bigint,
  currencyCode: string | null | undefined,
): string {
  void currencyCode;
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

export function formatRate(
  rateNum: string | number | bigint | null | undefined,
  rateDen?: string | number | bigint | null,
): string {
  if (rateNum === null || rateNum === undefined) return "";
  if (rateDen === null || rateDen === undefined) {
    const value = typeof rateNum === "number" ? rateNum : Number(rateNum);
    if (Number.isNaN(value)) return String(rateNum);
    return value.toLocaleString("ru-RU", {
      maximumFractionDigits: 8,
      minimumFractionDigits: 0,
    });
  }
  const numerator = typeof rateNum === "number" ? rateNum : Number(rateNum);
  const denominator = typeof rateDen === "number" ? rateDen : Number(rateDen);
  if (
    Number.isNaN(numerator) ||
    Number.isNaN(denominator) ||
    denominator === 0
  ) {
    return `${rateNum}/${rateDen}`;
  }
  return (numerator / denominator).toLocaleString("ru-RU", {
    maximumFractionDigits: 8,
    minimumFractionDigits: 0,
  });
}
