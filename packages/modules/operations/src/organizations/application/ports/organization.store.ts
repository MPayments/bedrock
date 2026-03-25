import type { Organization } from "../contracts/dto";
import type {
  CreateOrganizationInput,
  UpdateOrganizationInput,
} from "../contracts/commands";

export interface OrganizationStore {
  findById(id: number): Promise<Organization | null>;
  create(input: CreateOrganizationInput): Promise<Organization>;
  update(input: UpdateOrganizationInput): Promise<Organization | null>;
  softDelete(id: number): Promise<boolean>;
  restore(id: number): Promise<boolean>;
}
