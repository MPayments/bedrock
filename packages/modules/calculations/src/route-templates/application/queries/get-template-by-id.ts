import { PaymentRouteTemplateNotFoundError } from "../../../errors";
import {
  mapPaymentRouteTemplateRecord,
  type PaymentRouteTemplatesRepository,
} from "../ports/payment-routes.repository";

export class GetPaymentRouteTemplateByIdQuery {
  constructor(private readonly repository: PaymentRouteTemplatesRepository) {}

  async execute(id: string) {
    const existing = await this.repository.findTemplateById(id);

    if (!existing) {
      throw new PaymentRouteTemplateNotFoundError(id);
    }

    return mapPaymentRouteTemplateRecord(existing);
  }
}
