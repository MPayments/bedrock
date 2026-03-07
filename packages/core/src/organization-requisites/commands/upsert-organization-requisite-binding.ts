import { eq } from "drizzle-orm";

import { ensureOrganizationRequisiteBindingTx } from "../internal/bindings";
import type { OrganizationRequisitesServiceContext } from "../internal/context";
import { schema } from "../schema";
import {
  UpsertOrganizationRequisiteBindingInputSchema,
  type OrganizationRequisiteBinding,
  type UpsertOrganizationRequisiteBindingInput,
} from "../validation";
import { OrganizationRequisiteNotFoundError } from "../errors";

export function createUpsertOrganizationRequisiteBindingHandler(
  context: OrganizationRequisitesServiceContext,
) {
  const { db, log } = context;

  return async function upsertOrganizationRequisiteBinding(
    requisiteId: string,
    input: UpsertOrganizationRequisiteBindingInput,
  ): Promise<OrganizationRequisiteBinding> {
    const validated = UpsertOrganizationRequisiteBindingInputSchema.parse(input);

    return db.transaction(async (tx) => {
      const [requisite] = await tx
        .select({ id: schema.organizationRequisites.id })
        .from(schema.organizationRequisites)
        .where(eq(schema.organizationRequisites.id, requisiteId))
        .limit(1);

      if (!requisite) {
        throw new OrganizationRequisiteNotFoundError(requisiteId);
      }

      const binding = await ensureOrganizationRequisiteBindingTx(tx, {
        requisiteId,
        postingAccountNo: validated.postingAccountNo,
      });

      log.info("Organization requisite binding updated", { requisiteId });
      return binding;
    });
  };
}
