// Contract (DTOs and validation)
export {
  OrganizationType,
  OrganizationSchema,
  type Organization,
  CreateOrganizationInputSchema,
  type CreateOrganizationInput,
  UpdateOrganizationInputSchema,
  type UpdateOrganizationInput,
  OrganizationIdParamSchema,
} from "./contract.js";

// Service
export {
  createOrganizationsService,
  type OrganizationsService,
  type OrganizationsServiceDeps,
} from "./service.js";

// Repository (for wiring)
export { createOrganizationsRepo, type OrganizationsRepo } from "./repo.drizzle.js";
