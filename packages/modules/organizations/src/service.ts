import type { Logger } from "@repo/kernel";
import { AppError } from "@repo/kernel";
import type { OrganizationsRepo } from "./repo.drizzle.js";
import type { Organization, CreateOrganizationInput, UpdateOrganizationInput } from "./contract.js";

export interface OrganizationsServiceDeps {
  repo: OrganizationsRepo;
  logger: Logger;
}

export type OrganizationsService = ReturnType<typeof createOrganizationsService>;

/**
 * Creates the organizations service.
 * Handles business logic for organization management.
 */
export function createOrganizationsService(deps: OrganizationsServiceDeps) {
  const log = deps.logger.child({ module: "organizations" });

  const create = async (input: CreateOrganizationInput): Promise<Organization> => {
    const org = await deps.repo.insert(input);
    log.info("Created organization", { id: org.id, type: input.type, name: input.name });
    return org;
  };

  const getById = async (id: string): Promise<Organization> => {
    const org = await deps.repo.getById(id);
    if (!org) {
      throw new AppError("ORGANIZATION_NOT_FOUND", `Organization ${id} not found`);
    }
    return org;
  };

  const findById = async (id: string): Promise<Organization | null> => {
    return deps.repo.getById(id);
  };

  const list = async (): Promise<Organization[]> => {
    return deps.repo.list();
  };

  const update = async (id: string, input: UpdateOrganizationInput): Promise<Organization> => {
    const org = await deps.repo.update(id, input);
    if (!org) {
      throw new AppError("ORGANIZATION_NOT_FOUND", `Organization ${id} not found`);
    }
    log.info("Updated organization", { id, ...input });
    return org;
  };

  const del = async (id: string): Promise<void> => {
    const deleted = await deps.repo.delete(id);
    if (!deleted) {
      throw new AppError("ORGANIZATION_NOT_FOUND", `Organization ${id} not found`);
    }
    log.info("Deleted organization", { id });
  };

  return {
    create,
    getById,
    findById,
    list,
    update,
    delete: del,
  };
}
