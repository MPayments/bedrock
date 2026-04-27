import type { AgreementDetails } from "@bedrock/agreements/contracts";
import { ValidationError } from "@bedrock/shared/core/errors";

export function normalizeOptionalDecimalString(
  value: string | null | undefined,
  field: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = value.trim().replace(",", ".");
  if (!normalized) {
    return null;
  }

  if (!/^(?:\d+|\d+\.\d+)$/u.test(normalized)) {
    throw new ValidationError(`${field} must be a non-negative decimal string`);
  }

  return normalized;
}

function parseDecimalParts(value: string, field: string) {
  const normalized = normalizeOptionalDecimalString(value, field);

  if (normalized === undefined || normalized === null) {
    throw new ValidationError(`${field} is required`);
  }

  const [wholeRaw = "0", fractionRaw = ""] = normalized.split(".");
  const whole = wholeRaw.replace(/^0+(?=\d)/u, "") || "0";
  const fraction = fractionRaw.replace(/0+$/u, "");
  const digits = `${whole}${fraction}`.replace(/^0+(?=\d)/u, "") || "0";

  return {
    digits: BigInt(digits),
    scale: fraction.length,
  };
}

function decimalStringToRoundedInteger(
  value: string | null | undefined,
  field: string,
) {
  const normalized = normalizeOptionalDecimalString(value, field);

  if (normalized === undefined || normalized === null) {
    return 0n;
  }

  const parts = parseDecimalParts(normalized, field);
  const denominator = 10n ** BigInt(parts.scale);

  return (parts.digits + denominator / 2n) / denominator;
}

export function extractAgreementCommercialDefaults(input: {
  agreement: AgreementDetails;
  fallbackFixedFeeCurrency: string | null;
}) {
  let agreementFeeBps = 0n;
  let fixedFeeAmount: string | null = null;
  let fixedFeeCurrency: string | null = null;

  for (const rule of input.agreement.currentVersion.feeRules) {
    if (rule.kind === "agent_fee") {
      agreementFeeBps = decimalStringToRoundedInteger(
        rule.value,
        "agreement.agentFeeBps",
      );
      continue;
    }

    if (rule.kind === "fixed_fee") {
      fixedFeeAmount = normalizeOptionalDecimalString(
        rule.value,
        "agreement.fixedFee",
      ) ?? null;
      fixedFeeCurrency = rule.currencyCode ?? input.fallbackFixedFeeCurrency;
    }
  }

  return {
    agreementVersionId: input.agreement.currentVersion.id,
    agreementFeeBps,
    fixedFeeAmount,
    fixedFeeCurrency,
  };
}
