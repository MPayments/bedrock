import {
  ListPaymentRouteTemplatesQuerySchema,
  type ListPaymentRouteTemplatesQuery,
} from "../contracts/queries";
import { mapPaymentRouteTemplateListItem } from "../ports/payment-routes.repository";
import type { PaymentRouteTemplatesRepository } from "../ports/payment-routes.repository";

export class ListPaymentRouteTemplatesQueryHandler {
  constructor(private readonly repository: PaymentRouteTemplatesRepository) {}

  async execute(input: ListPaymentRouteTemplatesQuery) {
    const validated = ListPaymentRouteTemplatesQuerySchema.parse(input);
    const result = await this.repository.listTemplates(validated);

    return {
      data: result.rows.map(mapPaymentRouteTemplateListItem),
      limit: validated.limit,
      offset: validated.offset,
      total: result.total,
    };
  }
}
