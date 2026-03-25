import type { ModuleRuntime } from "@bedrock/shared/core";

import { BankDetailsNotFoundError } from "../../../errors";
import { normalizeLocalizedField } from "../../../shared/domain/localized-text";
import {
  UpdateBankDetailsInputSchema,
  type UpdateBankDetailsInput,
} from "../contracts/bank-details-commands";
import type { OrganizationsCommandUnitOfWork } from "../ports/organizations.uow";

export class UpdateBankDetailsCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: OrganizationsCommandUnitOfWork,
  ) {}

  async execute(input: UpdateBankDetailsInput) {
    const validated = UpdateBankDetailsInputSchema.parse(input);

    return this.unitOfWork.run(async (tx) => {
      const existing = await tx.bankDetailsStore.findById(validated.id);
      if (!existing) {
        throw new BankDetailsNotFoundError(validated.id);
      }

      const normalized = {
        ...validated,
        ...(validated.nameI18n !== undefined || validated.name !== undefined
          ? {
              nameI18n: normalizeLocalizedField(
                validated.name ?? existing.name ?? null,
                validated.nameI18n ?? existing.nameI18n,
              ),
            }
          : {}),
        ...(validated.bankNameI18n !== undefined ||
        validated.bankName !== undefined
          ? {
              bankNameI18n: normalizeLocalizedField(
                validated.bankName ?? existing.bankName ?? null,
                validated.bankNameI18n ?? existing.bankNameI18n,
              ),
            }
          : {}),
        ...(validated.bankAddressI18n !== undefined ||
        validated.bankAddress !== undefined
          ? {
              bankAddressI18n: normalizeLocalizedField(
                validated.bankAddress ?? existing.bankAddress ?? null,
                validated.bankAddressI18n ?? existing.bankAddressI18n,
              ),
            }
          : {}),
      };

      const updated = await tx.bankDetailsStore.update(normalized);
      if (!updated) {
        throw new BankDetailsNotFoundError(validated.id);
      }

      this.runtime.log.info("Bank details updated", { id: validated.id });

      return updated;
    });
  }
}
