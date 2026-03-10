import { and, eq, isNull, sql } from "drizzle-orm";

import type { RequisiteProvidersServiceContext } from "../context";
import { RequisiteProviderNotFoundError } from "../errors";
import { schema } from "../schema";
import {
  UpdateRequisiteProviderInputSchema,
  validateMergedRequisiteProviderState,
  type RequisiteProvider,
  type UpdateRequisiteProviderInput,
} from "../validation";

export function createUpdateRequisiteProviderHandler(
  context: RequisiteProvidersServiceContext,
) {
  const { db, log } = context;

  return async function updateRequisiteProvider(
    id: string,
    input: UpdateRequisiteProviderInput,
  ): Promise<RequisiteProvider> {
    const validated = UpdateRequisiteProviderInputSchema.parse(input);

    const [existing] = await db
      .select()
      .from(schema.requisiteProviders)
      .where(
        and(
          eq(schema.requisiteProviders.id, id),
          isNull(schema.requisiteProviders.archivedAt),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new RequisiteProviderNotFoundError(id);
    }

    validateMergedRequisiteProviderState({
      kind: validated.kind ?? existing.kind,
      country: validated.country !== undefined ? validated.country : existing.country,
      bic: validated.bic !== undefined ? validated.bic : existing.bic,
      swift: validated.swift !== undefined ? validated.swift : existing.swift,
    });

    const fields: Record<string, unknown> = {};
    if (validated.kind !== undefined) fields.kind = validated.kind;
    if (validated.name !== undefined) fields.name = validated.name;
    if (validated.description !== undefined) fields.description = validated.description;
    if (validated.country !== undefined) fields.country = validated.country;
    if (validated.address !== undefined) fields.address = validated.address;
    if (validated.contact !== undefined) fields.contact = validated.contact;
    if (validated.bic !== undefined) fields.bic = validated.bic;
    if (validated.swift !== undefined) fields.swift = validated.swift;

    if (Object.keys(fields).length === 0) {
      return existing;
    }

    fields.updatedAt = sql`now()`;

    const [updated] = await db
      .update(schema.requisiteProviders)
      .set(fields)
      .where(eq(schema.requisiteProviders.id, id))
      .returning();

    if (!updated) {
      throw new RequisiteProviderNotFoundError(id);
    }

    log.info("Requisite provider updated", { id });

    return updated;
  };
}
