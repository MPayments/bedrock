import type { PaymentStep, QuoteExecution } from "@bedrock/treasury/contracts";

import type { DealExecutionTreasuryModule } from "./deps";

const RUNTIME_PAGE_LIMIT = 100;

type PaymentStepsQueries = DealExecutionTreasuryModule["paymentSteps"]["queries"];
type PaymentStepsListInput = Parameters<PaymentStepsQueries["list"]>[0];
type QuoteExecutionsQueries =
  DealExecutionTreasuryModule["quoteExecutions"]["queries"];
type QuoteExecutionsListInput = Parameters<QuoteExecutionsQueries["list"]>[0];

export async function listAllPaymentSteps(
  queries: PaymentStepsQueries,
  input: Omit<PaymentStepsListInput, "limit" | "offset">,
): Promise<PaymentStep[]> {
  const rows: PaymentStep[] = [];
  let offset = 0;

  while (true) {
    const page = await queries.list({
      ...input,
      limit: RUNTIME_PAGE_LIMIT,
      offset,
    });
    rows.push(...page.data);
    offset += page.limit;
    if (offset >= page.total) {
      break;
    }
  }

  return rows;
}

export async function listAllQuoteExecutions(
  queries: QuoteExecutionsQueries,
  input: Omit<QuoteExecutionsListInput, "limit" | "offset">,
): Promise<QuoteExecution[]> {
  const rows: QuoteExecution[] = [];
  let offset = 0;

  while (true) {
    const page = await queries.list({
      ...input,
      limit: RUNTIME_PAGE_LIMIT,
      offset,
    });
    rows.push(...page.data);
    offset += page.limit;
    if (offset >= page.total) {
      break;
    }
  }

  return rows;
}

export async function listAllDealLegRuntimes(
  treasuryModule: DealExecutionTreasuryModule,
  dealId: string,
): Promise<{
  paymentSteps: PaymentStep[];
  quoteExecutions: QuoteExecution[];
}> {
  const [paymentSteps, quoteExecutions] = await Promise.all([
    listAllPaymentSteps(treasuryModule.paymentSteps.queries, {
      dealId,
      purpose: "deal_leg",
    }),
    listAllQuoteExecutions(treasuryModule.quoteExecutions.queries, { dealId }),
  ]);

  return { paymentSteps, quoteExecutions };
}
