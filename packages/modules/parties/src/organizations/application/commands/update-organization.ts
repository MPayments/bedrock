import type { ModuleRuntime } from "@bedrock/shared/core";
import { applyPatch } from "@bedrock/shared/core/patch";

import {
  UpdateOrganizationInputSchema,
  type UpdateOrganizationInput,
} from "../contracts/commands";
import { OrganizationNotFoundError } from "../errors";
import type { OrganizationsCommandUnitOfWork } from "../ports/organizations.uow";

export class UpdateOrganizationCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly uow: OrganizationsCommandUnitOfWork,
  ) {}

  async execute(id: string, input: UpdateOrganizationInput) {
    const validated = UpdateOrganizationInputSchema.parse(input);

    return this.uow.run(async (tx) => {
      const existing = await tx.organizationStore.findById(id);
      if (!existing) {
        throw new OrganizationNotFoundError(id);
      }

      const next = applyPatch(
        {
          externalId: existing.externalId,
          shortName: existing.shortName,
          fullName: existing.fullName,
          description: existing.description,
          country: existing.country,
          kind: existing.kind,
          isActive: existing.isActive,
          nameI18n: existing.nameI18n,
          orgType: existing.orgType,
          orgTypeI18n: existing.orgTypeI18n,
          countryI18n: existing.countryI18n,
          city: existing.city,
          cityI18n: existing.cityI18n,
          address: existing.address,
          addressI18n: existing.addressI18n,
          inn: existing.inn,
          taxId: existing.taxId,
          kpp: existing.kpp,
          ogrn: existing.ogrn,
          oktmo: existing.oktmo,
          okpo: existing.okpo,
          directorName: existing.directorName,
          directorNameI18n: existing.directorNameI18n,
          directorPosition: existing.directorPosition,
          directorPositionI18n: existing.directorPositionI18n,
          directorBasis: existing.directorBasis,
          directorBasisI18n: existing.directorBasisI18n,
          signatureKey: existing.signatureKey,
          sealKey: existing.sealKey,
        },
        validated,
      );

      const updated = await tx.organizationStore.update({
        id,
        ...next,
      });

      if (!updated) {
        throw new OrganizationNotFoundError(id);
      }

      this.runtime.log.info("Organization updated", { id });
      return updated;
    });
  }
}
