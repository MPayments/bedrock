import type { ModuleRuntime } from "@bedrock/shared/core";

import { PaymentRouteTemplateNotFoundError } from "../../../errors";
import { PaymentRouteTemplateAggregate } from "../../domain/payment-route-template";
import {
  mapPaymentRouteTemplateRecord,
  type PaymentRouteTemplatesRepository,
} from "../ports/payment-routes.repository";

export class ArchivePaymentRouteTemplateCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly repository: PaymentRouteTemplatesRepository,
  ) {}

  async execute(id: string) {
    const existing = await this.repository.findTemplateById(id);

    if (!existing) {
      throw new PaymentRouteTemplateNotFoundError(id);
    }

    if (existing.status === "archived") {
      return mapPaymentRouteTemplateRecord(existing);
    }

    const updated = PaymentRouteTemplateAggregate.fromSnapshot(existing).archive(
      this.runtime.now(),
    );

    return mapPaymentRouteTemplateRecord(
      (await this.repository.updateTemplate(id, updated.toSnapshot()))!,
    );
  }
}
