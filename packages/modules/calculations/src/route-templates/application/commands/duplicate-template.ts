import type { ModuleRuntime } from "@bedrock/shared/core";

import { PaymentRouteTemplateNotFoundError } from "../../../errors";
import { PaymentRouteTemplateAggregate } from "../../domain/payment-route-template";
import {
  mapPaymentRouteTemplateRecord,
  type PaymentRouteTemplatesRepository,
} from "../ports/payment-routes.repository";

function buildDuplicateName(name: string) {
  return `${name.trim()} (копия)`;
}

export class DuplicatePaymentRouteTemplateCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly repository: PaymentRouteTemplatesRepository,
  ) {}

  async execute(id: string) {
    const existing = await this.repository.findTemplateById(id);

    if (!existing) {
      throw new PaymentRouteTemplateNotFoundError(id);
    }

    const duplicate = PaymentRouteTemplateAggregate.fromSnapshot(existing).duplicate(
      {
        id: this.runtime.generateUuid(),
        name: buildDuplicateName(existing.name),
        now: this.runtime.now(),
      },
    );

    return mapPaymentRouteTemplateRecord(
      await this.repository.insertTemplate(duplicate.toSnapshot()),
    );
  }
}
