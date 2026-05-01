import { DealPricingProfitabilitySchema } from "@bedrock/deals/contracts";
import { ValidationError } from "@bedrock/shared/core/errors";

const FEE_REVENUE_BUCKETS = new Set(["commercial_revenue", "fee_revenue"]);
const CUSTOMER_EXPENSE_BUCKETS = new Set([
  "execution_expense",
  "provider_fee_expense",
]);

export type DealInvoicePurpose = "agency_fee" | "combined" | "principal";
export type DealInvoiceFeeBillingMode =
  | "included_in_principal_invoice"
  | "separate_fee_invoice";

export interface DealInvoiceBillingFinancialLine {
  amountMinor: string | bigint;
  bucket: string;
  currency: string;
  id?: string;
}

export interface DealInvoiceBillingQuoteDetails {
  financialLines: DealInvoiceBillingFinancialLine[];
  quote: {
    fromAmountMinor: string | bigint;
    fromCurrency?: string | null;
    id: string;
  };
  pricingTrace?: Record<string, unknown> | null;
}

export interface DealInvoiceBillingSplitInput {
  dealId: string;
  feeBillingMode?: DealInvoiceFeeBillingMode | null;
  quoteDetails: DealInvoiceBillingQuoteDetails | null;
}

export interface DealInvoiceBillingSelectionInput {
  dealId: string;
  invoicePurpose: DealInvoicePurpose;
  quoteDetails: DealInvoiceBillingQuoteDetails;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isCustomerSideLine(line: DealInvoiceBillingFinancialLine) {
  return !CUSTOMER_EXPENSE_BUCKETS.has(line.bucket);
}

function isFeeRevenueLine(line: DealInvoiceBillingFinancialLine) {
  return FEE_REVENUE_BUCKETS.has(line.bucket);
}

function lineIds(lines: DealInvoiceBillingFinancialLine[]) {
  return lines
    .map((line) => line.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

function buildLegacyCustomerTotalMinor(
  quoteDetails: DealInvoiceBillingQuoteDetails,
  principalCurrency: string,
) {
  return (
    BigInt(quoteDetails.quote.fromAmountMinor) +
    quoteDetails.financialLines
      .filter(
        (line) =>
          line.currency === principalCurrency && isCustomerSideLine(line),
      )
      .reduce((total, line) => {
        const amount = BigInt(line.amountMinor);
        return line.bucket === "commercial_discount"
          ? total - amount
          : total + amount;
      }, 0n)
  );
}

function readCrmCustomerTotalMinor(
  quoteDetails: DealInvoiceBillingQuoteDetails,
  principalCurrency: string,
) {
  const metadata = readRecord(quoteDetails.pricingTrace?.["metadata"]);
  const crmPricingSnapshot = readRecord(metadata?.["crmPricingSnapshot"]);
  const profitability = DealPricingProfitabilitySchema.safeParse(
    crmPricingSnapshot?.["profitability"],
  );

  if (
    !profitability.success ||
    profitability.data.currency !== principalCurrency
  ) {
    return null;
  }

  return BigInt(profitability.data.customerTotalMinor);
}

export function buildDealInvoiceBillingSplit(
  input: DealInvoiceBillingSplitInput,
) {
  if (!input.quoteDetails?.quote.fromCurrency) {
    return null;
  }

  const mode = input.feeBillingMode ?? "included_in_principal_invoice";
  const principalCurrency = input.quoteDetails.quote.fromCurrency;
  const customerSideLines =
    input.quoteDetails.financialLines.filter(isCustomerSideLine);
  const feeRevenueLines = customerSideLines.filter(isFeeRevenueLine);
  const feeCurrencies = new Set(feeRevenueLines.map((line) => line.currency));
  const blockedReason =
    mode === "separate_fee_invoice" &&
    (feeCurrencies.size > 1 ||
      (feeCurrencies.size === 1 && !feeCurrencies.has(principalCurrency)))
      ? "Split fee invoice requires all fee revenue lines to use the principal invoice currency"
      : null;
  const customerTotalMinor =
    readCrmCustomerTotalMinor(input.quoteDetails, principalCurrency) ??
    buildLegacyCustomerTotalMinor(input.quoteDetails, principalCurrency);
  const feeRevenueMinor = feeRevenueLines
    .filter((line) => line.currency === principalCurrency)
    .reduce((total, line) => total + BigInt(line.amountMinor), 0n);
  const billingSetRef = `billing_set:${input.dealId}:${input.quoteDetails.quote.id}`;

  if (mode === "separate_fee_invoice") {
    return {
      agencyFee:
        feeRevenueMinor > 0n
          ? {
              amountMinor: feeRevenueMinor.toString(),
              currency: principalCurrency,
              invoicePurpose: "agency_fee" as const,
            }
          : null,
      billingSetRef,
      blockedReason,
      mode,
      principal: {
        amountMinor: (customerTotalMinor - feeRevenueMinor).toString(),
        currency: principalCurrency,
        invoicePurpose: "principal" as const,
      },
    };
  }

  return {
    agencyFee: null,
    billingSetRef: null,
    blockedReason: null,
    mode,
    principal: {
      amountMinor: customerTotalMinor.toString(),
      currency: principalCurrency,
      invoicePurpose: "combined" as const,
    },
  };
}

export function resolveDealInvoiceBillingSelection(
  input: DealInvoiceBillingSelectionInput,
) {
  if (!input.quoteDetails.quote.fromCurrency) {
    throw new ValidationError(
      "Split invoice creation requires a resolved quote source currency",
    );
  }

  const mode =
    input.invoicePurpose === "combined"
      ? "included_in_principal_invoice"
      : "separate_fee_invoice";
  const split = buildDealInvoiceBillingSplit({
    dealId: input.dealId,
    feeBillingMode: mode,
    quoteDetails: input.quoteDetails,
  });

  if (!split) {
    throw new ValidationError(
      "Split invoice creation requires a resolved quote source currency",
    );
  }
  if (split.blockedReason) {
    throw new ValidationError(split.blockedReason);
  }

  const selected =
    input.invoicePurpose === "agency_fee" ? split.agencyFee : split.principal;

  if (!selected) {
    throw new ValidationError(
      "Split fee invoice requires positive fee revenue lines",
    );
  }

  const customerSideLines =
    input.quoteDetails.financialLines.filter(isCustomerSideLine);
  const feeRevenueLines = customerSideLines.filter(isFeeRevenueLine);
  const quoteComponentIds =
    input.invoicePurpose === "agency_fee"
      ? lineIds(feeRevenueLines)
      : lineIds(customerSideLines.filter((line) => !isFeeRevenueLine(line)));

  return {
    amountMinor: selected.amountMinor,
    billingSetRef: split.billingSetRef,
    currency: selected.currency,
    invoicePurpose: selected.invoicePurpose,
    quoteComponentIds,
  };
}
