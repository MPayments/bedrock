import type { ModuleRuntime } from "@bedrock/shared/core";

import { normalizeLocalizedField } from "../../../shared/domain/localized-text";
import {
  CreateBankDetailsInputSchema,
  type CreateBankDetailsInput,
} from "../contracts/bank-details-commands";
import type { OrganizationsCommandUnitOfWork } from "../ports/organizations.uow";

export class CreateBankDetailsCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: OrganizationsCommandUnitOfWork,
  ) {}

  async execute(input: CreateBankDetailsInput) {
    const validated = CreateBankDetailsInputSchema.parse(input);

    return this.unitOfWork.run(async (tx) => {
      const normalized = {
        ...validated,
        nameI18n: normalizeLocalizedField(
          validated.name ?? null,
          validated.nameI18n,
        ),
        bankNameI18n: normalizeLocalizedField(
          validated.bankName ?? null,
          validated.bankNameI18n,
        ),
        bankAddressI18n: normalizeLocalizedField(
          validated.bankAddress ?? null,
          validated.bankAddressI18n,
        ),
      };

      const created = await tx.bankDetailsStore.create(normalized);

      this.runtime.log.info("Bank details created", {
        id: created.id,
        organizationId: created.organizationId,
      });

      return created;
    });
  }
}
