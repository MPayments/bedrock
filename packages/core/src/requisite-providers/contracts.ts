import { z } from "zod";

export {
  RequisiteProviderSchema,
  REQUISITE_PROVIDERS_LIST_CONTRACT,
  ListRequisiteProvidersQuerySchema,
  CreateRequisiteProviderInputSchema,
  UpdateRequisiteProviderInputSchema,
} from "./validation";

export type {
  RequisiteProvider,
  ListRequisiteProvidersQuery,
  CreateRequisiteProviderInput,
  UpdateRequisiteProviderInput,
} from "./validation";

export const RequisiteProviderOptionSchema = z.object({
  id: z.uuid(),
  kind: z.string(),
  name: z.string(),
  label: z.string(),
});

export const RequisiteProviderOptionsResponseSchema = z.object({
  data: z.array(RequisiteProviderOptionSchema),
});

export type RequisiteProviderOption = z.infer<typeof RequisiteProviderOptionSchema>;
