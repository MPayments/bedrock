import { DrizzleHoldingOrganizationBridge } from "@bedrock/operations/adapters/drizzle";
import {
  OrganizationNotFoundError,
} from "@bedrock/parties";
import type { Organization } from "@bedrock/parties/contracts";

import type { AppContext } from "../context";
import { db } from "../db/client";

export function createHoldingOrganizationBridge() {
  return new DrizzleHoldingOrganizationBridge(db);
}

export async function findLegacyHoldingOrganizationByCanonicalId(
  organizationId: string,
) {
  return createHoldingOrganizationBridge().findByCanonicalOrganizationId(
    organizationId,
  );
}

export async function resolveLegacyHoldingOrganizationByCanonicalId(
  organizationId: string,
) {
  const organization = await findLegacyHoldingOrganizationByCanonicalId(
    organizationId,
  );
  if (!organization) {
    throw new OrganizationNotFoundError(organizationId);
  }

  return organization;
}

export async function findCanonicalOrganizationByLegacyId(
  ctx: AppContext,
  legacyOrganizationId: number,
): Promise<Organization | null> {
  const legacyOrganization =
    await createHoldingOrganizationBridge().findByLegacyId(legacyOrganizationId);
  if (!legacyOrganization?.organizationId) {
    return null;
  }

  return ctx.partiesModule.organizations.queries.findById(
    legacyOrganization.organizationId,
  );
}

export async function resolveCanonicalOrganizationByLegacyId(
  ctx: AppContext,
  legacyOrganizationId: number,
): Promise<Organization> {
  const organization = await findCanonicalOrganizationByLegacyId(
    ctx,
    legacyOrganizationId,
  );
  if (!organization) {
    throw new OrganizationNotFoundError(String(legacyOrganizationId));
  }

  return organization;
}
