import type { RequisiteProvidersServiceContext } from "../context";
import { schema } from "../schema";
import {
  CreateRequisiteProviderInputSchema,
  type CreateRequisiteProviderInput,
  type RequisiteProvider,
} from "../validation";

export function createCreateRequisiteProviderHandler(
  context: RequisiteProvidersServiceContext,
) {
  const { db, log } = context;

  return async function createRequisiteProvider(
    input: CreateRequisiteProviderInput,
  ): Promise<RequisiteProvider> {
    const validated = CreateRequisiteProviderInputSchema.parse(input);

    const [created] = await db
      .insert(schema.requisiteProviders)
      .values({
        kind: validated.kind,
        name: validated.name,
        description: validated.description ?? null,
        country: validated.country ?? null,
        address: validated.address ?? null,
        contact: validated.contact ?? null,
        bic: validated.bic ?? null,
        swift: validated.swift ?? null,
      })
      .returning();

    log.info("Requisite provider created", {
      id: created!.id,
      name: created!.name,
    });

    return created!;
  };
}
