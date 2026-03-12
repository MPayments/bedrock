function normalizeAmountValue(value: unknown): string {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("amount must be a finite number");
    }
    return String(value);
  }

  if (typeof value === "string") {
    return value.trim();
  }

  throw new Error("amount must be a string, number, or bigint");
}

function isDigits(value: string): boolean {
  if (value.length === 0) {
    return false;
  }

  for (const char of value) {
    if (char < "0" || char > "9") {
      return false;
    }
  }

  return true;
}

function parseAmountParts(input: string): {
  signRaw: "" | "-";
  integerRaw: string;
  fractionRaw: string;
} | null {
  const signRaw = input.startsWith("-") ? "-" : "";
  const unsigned = signRaw ? input.slice(1) : input;
  const dotIndex = unsigned.indexOf(".");
  const hasDot = dotIndex !== -1;

  if (!hasDot) {
    if (!isDigits(unsigned)) {
      return null;
    }
    return {
      signRaw,
      integerRaw: unsigned,
      fractionRaw: "",
    };
  }

  if (unsigned.indexOf(".", dotIndex + 1) !== -1) {
    return null;
  }

  const integerRaw = unsigned.slice(0, dotIndex);
  const fractionRaw = unsigned.slice(dotIndex + 1);
  if (!isDigits(integerRaw) || !isDigits(fractionRaw)) {
    return null;
  }

  return {
    signRaw,
    integerRaw,
    fractionRaw,
  };
}

function resolveCurrencyPrecision(currencyCode: unknown): number {
  if (typeof currencyCode !== "string") {
    return 2;
  }

  const normalized = currencyCode.trim().toUpperCase();
  if (normalized.length === 0) {
    return 2;
  }

  try {
    const options = new Intl.NumberFormat("en", {
      style: "currency",
      currency: normalized,
    }).resolvedOptions();
    return Math.max(0, Math.trunc(options.maximumFractionDigits ?? 2));
  } catch {
    return 2;
  }
}

export function toMinorAmountString(
  amountValue: unknown,
  currencyCode: unknown,
  options?: { requirePositive?: boolean },
): string {
  const normalized = normalizeAmountValue(amountValue).replace(",", ".");
  const parsed = parseAmountParts(normalized);
  if (!parsed) {
    throw new Error("amount must be a number, e.g. 1000.50");
  }

  const { signRaw, integerRaw, fractionRaw } = parsed;
  const precision = resolveCurrencyPrecision(currencyCode);

  if (fractionRaw.length > precision) {
    const currency =
      typeof currencyCode === "string" ? currencyCode.trim().toUpperCase() : "";
    throw new Error(
      `amount has too many fraction digits for ${
        currency.length > 0 ? currency : "selected currency"
      }: max ${precision}`,
    );
  }

  const fractionPart = fractionRaw.padEnd(precision, "0");
  const normalizedInteger = integerRaw.replace(/^0+(?=\d)/, "");
  const minorDigits = `${normalizedInteger}${fractionPart}`.replace(
    /^0+(?=\d)/,
    "",
  );
  let minorAmount = BigInt(minorDigits.length > 0 ? minorDigits : "0");

  if (signRaw === "-" && minorAmount !== 0n) {
    minorAmount = -minorAmount;
  }

  if (options?.requirePositive && minorAmount <= 0n) {
    throw new Error("amount must be positive");
  }

  return minorAmount.toString();
}
