import { z } from "zod";

export {
  RequisiteOwnerTypeSchema,
  RequisiteSchema,
  RequisiteAccountingBindingSchema,
  REQUISITES_LIST_CONTRACT,
  ListRequisitesQuerySchema,
  CreateRequisiteInputSchema,
  UpdateRequisiteInputSchema,
  ListRequisiteOptionsQuerySchema,
  UpsertRequisiteAccountingBindingInputSchema,
} from "./validation";

export type {
  RequisiteOwnerType,
  Requisite,
  RequisiteAccountingBinding,
  ListRequisitesQuery,
  CreateRequisiteInput,
  UpdateRequisiteInput,
  ListRequisiteOptionsQuery,
  UpsertRequisiteAccountingBindingInput,
} from "./validation";

export const RequisiteOptionSchema = z.object({
  id: z.uuid(),
  ownerType: z.string(),
  ownerId: z.uuid(),
  currencyId: z.uuid(),
  providerId: z.uuid(),
  kind: z.string(),
  label: z.string(),
});

export const RequisiteOptionsResponseSchema = z.object({
  data: z.array(RequisiteOptionSchema),
});

export type RequisiteOption = z.infer<typeof RequisiteOptionSchema>;
