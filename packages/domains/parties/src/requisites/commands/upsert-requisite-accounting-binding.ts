import { eq } from "drizzle-orm";

import { ensureRequisiteAccountingBindingTx } from "../bindings";
import type { RequisitesServiceContext } from "../context";
import { RequisiteNotFoundError } from "../errors";
import { schema } from "../schema";
import {
  UpsertRequisiteAccountingBindingInputSchema,
  type RequisiteAccountingBinding,
  type UpsertRequisiteAccountingBindingInput,
} from "../validation";

export function createUpsertRequisiteAccountingBindingHandler(
  context: RequisitesServiceContext,
) {
  const { db, log } = context;

  return async function upsertRequisiteAccountingBinding(
    requisiteId: string,
    input: UpsertRequisiteAccountingBindingInput,
  ): Promise<RequisiteAccountingBinding> {
    const validated = UpsertRequisiteAccountingBindingInputSchema.parse(input);

    return db.transaction(async (tx) => {
      const [requisite] = await tx
        .select({ id: schema.requisites.id })
        .from(schema.requisites)
        .where(eq(schema.requisites.id, requisiteId))
        .limit(1);

      if (!requisite) {
        throw new RequisiteNotFoundError(requisiteId);
      }

      const binding = await ensureRequisiteAccountingBindingTx(tx, {
        requisiteId,
        postingAccountNo: validated.postingAccountNo,
      });

      log.info("Requisite accounting binding updated", { requisiteId });
      return binding;
    });
  };
}
