import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { PaymentStep } from "../../contracts/dto";
import type { PaymentStepsServiceContext } from "../context";
import {
  ListPaymentStepsQuerySchema,
  type ListPaymentStepsQuery,
} from "../contracts/queries";
import { mapPaymentStep } from "../map-payment-step";

export function createListPaymentStepsQuery(
  context: PaymentStepsServiceContext,
) {
  return async function listPaymentSteps(
    raw: ListPaymentStepsQuery,
  ): Promise<PaginatedList<PaymentStep>> {
    const input = ListPaymentStepsQuerySchema.parse(raw);
    const result = await context.repository.listSteps(input);

    return {
      data: result.rows.map(mapPaymentStep),
      limit: input.limit,
      offset: input.offset,
      total: result.total,
    };
  };
}
