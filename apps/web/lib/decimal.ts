interface Fraction {
  num: bigint;
  den: bigint;
}

interface ParseDecimalToFractionOptions {
  allowScientific?: boolean;
}

export function parseDecimalToFraction(
  input: string,
  options: ParseDecimalToFractionOptions = {},
): Fraction {
  if ((options.allowScientific ?? true) === false && /e/i.test(input)) {
    throw new Error(`invalid decimal number: ${input}`);
  }

  const normalized = input.replace(",", ".").trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    throw new Error(`invalid decimal number: ${input}`);
  }

  const [intPart, fracPart = ""] = normalized.split(".");
  const num = BigInt(`${intPart}${fracPart}`);
  if (num <= 0n) {
    throw new Error(`decimal must be positive: ${input}`);
  }

  const den = 10n ** BigInt(fracPart.length);
  const divisor = gcd(num, den);
  return {
    num: num / divisor,
    den: den / divisor,
  };
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a;
  let y = b;

  while (y !== 0n) {
    const rest = x % y;
    x = y;
    y = rest;
  }

  return x;
}
