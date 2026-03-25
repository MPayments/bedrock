import type { ModuleRuntime } from "@bedrock/shared/core";

import { OrganizationNotFoundError } from "../../../errors";
import { normalizeLocalizedField } from "../../../shared/domain/localized-text";
import {
  UpdateOrganizationInputSchema,
  type UpdateOrganizationInput,
} from "../contracts/commands";
import type { OrganizationsCommandUnitOfWork } from "../ports/organizations.uow";

export class UpdateOrganizationCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: OrganizationsCommandUnitOfWork,
  ) {}

  async execute(input: UpdateOrganizationInput) {
    const validated = UpdateOrganizationInputSchema.parse(input);

    return this.unitOfWork.run(async (tx) => {
      const existing = await tx.organizationStore.findById(validated.id);
      if (!existing) {
        throw new OrganizationNotFoundError(validated.id);
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
        ...(validated.orgTypeI18n !== undefined ||
        validated.orgType !== undefined
          ? {
              orgTypeI18n: normalizeLocalizedField(
                validated.orgType ?? existing.orgType ?? null,
                validated.orgTypeI18n ?? existing.orgTypeI18n,
              ),
            }
          : {}),
        ...(validated.countryI18n !== undefined ||
        validated.country !== undefined
          ? {
              countryI18n: normalizeLocalizedField(
                validated.country ?? existing.country ?? null,
                validated.countryI18n ?? existing.countryI18n,
              ),
            }
          : {}),
        ...(validated.cityI18n !== undefined || validated.city !== undefined
          ? {
              cityI18n: normalizeLocalizedField(
                validated.city ?? existing.city ?? null,
                validated.cityI18n ?? existing.cityI18n,
              ),
            }
          : {}),
        ...(validated.addressI18n !== undefined ||
        validated.address !== undefined
          ? {
              addressI18n: normalizeLocalizedField(
                validated.address ?? existing.address ?? null,
                validated.addressI18n ?? existing.addressI18n,
              ),
            }
          : {}),
        ...(validated.directorNameI18n !== undefined ||
        validated.directorName !== undefined
          ? {
              directorNameI18n: normalizeLocalizedField(
                validated.directorName ?? existing.directorName ?? null,
                validated.directorNameI18n ?? existing.directorNameI18n,
              ),
            }
          : {}),
        ...(validated.directorPositionI18n !== undefined ||
        validated.directorPosition !== undefined
          ? {
              directorPositionI18n: normalizeLocalizedField(
                validated.directorPosition ??
                  existing.directorPosition ??
                  null,
                validated.directorPositionI18n ??
                  existing.directorPositionI18n,
              ),
            }
          : {}),
        ...(validated.directorBasisI18n !== undefined ||
        validated.directorBasis !== undefined
          ? {
              directorBasisI18n: normalizeLocalizedField(
                validated.directorBasis ?? existing.directorBasis ?? null,
                validated.directorBasisI18n ?? existing.directorBasisI18n,
              ),
            }
          : {}),
      };

      const updated = await tx.organizationStore.update(normalized);
      if (!updated) {
        throw new OrganizationNotFoundError(validated.id);
      }

      this.runtime.log.info("Organization updated", { id: validated.id });

      return updated;
    });
  }
}
