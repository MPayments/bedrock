import { z } from "zod";

import { CompiledPack } from "../../domain";
import { AccountingPackDefinitionSchema } from "../../schema";

export const PackChecksumSchema = z.string().trim().min(1);

export const ActivatePackForScopeInputSchema = z.object({
  scopeId: z.string().trim().min(1),
  packChecksum: PackChecksumSchema,
  effectiveAt: z.coerce.date().optional(),
  scopeType: z.string().trim().min(1).optional(),
});

export const StorePackVersionInputSchema = z.object({
  definition: AccountingPackDefinitionSchema.optional(),
  pack: z.instanceof(CompiledPack).optional(),
});

export type ActivatePackForScopeInput = z.infer<
  typeof ActivatePackForScopeInputSchema
>;
export type StorePackVersionInput = z.infer<
  typeof StorePackVersionInputSchema
>;
