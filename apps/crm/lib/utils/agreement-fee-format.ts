import { formatDecimalString } from "@bedrock/shared/money";

export type AgreementFeeRuleView = {
  currencyCode: string | null;
  kind: "agent_fee" | "fixed_fee";
  unit: "bps" | "money";
  value: string;
};

const DECIMAL_PATTERN = /^[+-]?\d+(?:\.\d+)?$/u;

function normalizeDecimalString(value: string): string | null {
  const trimmed = value.trim();
  if (!DECIMAL_PATTERN.test(trimmed)) {
    return null;
  }

  const negative = trimmed.startsWith("-");
  const unsigned = trimmed.replace(/^[+-]/u, "");
  const [wholeRaw = "0", fractionRaw = ""] = unsigned.split(".");
  const whole = wholeRaw.replace(/^0+(?=\d)/u, "") || "0";
  const fraction = fractionRaw.replace(/0+$/u, "");
  const normalized = fraction.length > 0 ? `${whole}.${fraction}` : whole;

  if (normalized === "0") {
    return "0";
  }

  return negative ? `-${normalized}` : normalized;
}

function shiftDecimalString(
  value: string,
  decimalPlaces: number,
): string | null {
  const normalized = normalizeDecimalString(value);
  if (!normalized) {
    return null;
  }

  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [wholeRaw = "0", fractionRaw = ""] = unsigned.split(".");
  const digits = `${wholeRaw}${fractionRaw}`.replace(/^0+(?=\d)/u, "") || "0";
  const nextScale = fractionRaw.length - decimalPlaces;

  if (digits === "0") {
    return "0";
  }

  let shifted: string;
  if (nextScale <= 0) {
    shifted = `${digits}${"0".repeat(-nextScale)}`;
  } else if (nextScale >= digits.length) {
    shifted = `0.${"0".repeat(nextScale - digits.length)}${digits}`;
  } else {
    const integerPart = digits.slice(0, digits.length - nextScale);
    const fractionPart = digits.slice(digits.length - nextScale);
    shifted = `${integerPart}.${fractionPart}`;
  }

  return normalizeDecimalString(`${negative ? "-" : ""}${shifted}`);
}

function formatDecimalCurrency(
  value: string,
  currencyCode: string | null | undefined,
): string {
  let formattedNumber: string;

  try {
    formattedNumber = formatDecimalString(value, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return "—";
  }

  try {
    const currencyPart = new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: currencyCode ?? "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
      .formatToParts(1)
      .find((part) => part.type === "currency")
      ?.value;

    return currencyPart
      ? `${formattedNumber} ${currencyPart}`
      : formattedNumber;
  } catch {
    return formattedNumber;
  }
}

export function formatAgreementFeeRuleLabel(
  rule: AgreementFeeRuleView,
): string {
  if (rule.kind === "agent_fee") {
    const percent = shiftDecimalString(rule.value, -2);
    return percent
      ? `Агентская комиссия ${percent}%`
      : "Агентская комиссия —";
  }

  const amount = formatDecimalCurrency(rule.value, rule.currencyCode ?? "USD");
  return amount === "—"
    ? "Фиксированная комиссия —"
    : `Фиксированная комиссия ${amount}`;
}
