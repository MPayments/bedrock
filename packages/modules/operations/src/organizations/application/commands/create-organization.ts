import type { ModuleRuntime } from "@bedrock/shared/core";

import { normalizeLocalizedField } from "../../../shared/domain/localized-text";
import {
  CreateOrganizationInputSchema,
  type CreateOrganizationInput,
} from "../contracts/commands";
import type { OrganizationsCommandUnitOfWork } from "../ports/organizations.uow";

export class CreateOrganizationCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: OrganizationsCommandUnitOfWork,
  ) {}

  async execute(input: CreateOrganizationInput) {
    const validated = CreateOrganizationInputSchema.parse(input);

    return this.unitOfWork.run(async (tx) => {
      const normalized = {
        ...validated,
        nameI18n: normalizeLocalizedField(
          validated.name ?? null,
          validated.nameI18n,
        ),
        orgTypeI18n: normalizeLocalizedField(
          validated.orgType ?? null,
          validated.orgTypeI18n,
        ),
        countryI18n: normalizeLocalizedField(
          validated.country ?? null,
          validated.countryI18n,
        ),
        cityI18n: normalizeLocalizedField(
          validated.city ?? null,
          validated.cityI18n,
        ),
        addressI18n: normalizeLocalizedField(
          validated.address ?? null,
          validated.addressI18n,
        ),
        directorNameI18n: normalizeLocalizedField(
          validated.directorName ?? null,
          validated.directorNameI18n,
        ),
        directorPositionI18n: normalizeLocalizedField(
          validated.directorPosition ?? null,
          validated.directorPositionI18n,
        ),
        directorBasisI18n: normalizeLocalizedField(
          validated.directorBasis ?? null,
          validated.directorBasisI18n,
        ),
      };

      const created = await tx.organizationStore.create(normalized);

      this.runtime.log.info("Organization created", {
        id: created.id,
        name: created.name,
      });

      return created;
    });
  }
}
