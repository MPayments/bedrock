import { z } from "zod";

import { trimToNull } from "@bedrock/shared/core";
import {
  CountryCodeSchema,
  RequisiteKindSchema,
} from "@bedrock/shared/requisites";

const nullableText = z
  .string()
  .trim()
  .max(500)
  .nullish()
  .transform((value) => trimToNull(value) ?? null);
const nullableShortText = z
  .string()
  .trim()
  .max(255)
  .nullish()
  .transform((value) => trimToNull(value) ?? null);
const nullableCountry = CountryCodeSchema.nullish().transform(
  (value) => value ?? null,
);
const nullableTextPatch = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .transform((value) => trimToNull(value))
  .exactOptional();
const nullableShortTextPatch = z
  .string()
  .trim()
  .max(255)
  .nullable()
  .transform((value) => trimToNull(value))
  .exactOptional();
const nullableCountryPatch = CountryCodeSchema.nullable().exactOptional();

export const CreateOrganizationRequisiteInputSchema = z.object({
  organizationId: z.uuid(),
  providerId: z.uuid(),
  currencyId: z.uuid(),
  kind: RequisiteKindSchema,
  label: z.string().trim().min(1).max(255),
  description: nullableText,
  beneficiaryName: nullableShortText,
  institutionName: nullableShortText,
  institutionCountry: nullableCountry,
  accountNo: nullableShortText,
  corrAccount: nullableShortText,
  iban: nullableShortText,
  bic: nullableShortText,
  swift: nullableShortText,
  bankAddress: nullableText,
  network: nullableShortText,
  assetCode: nullableShortText,
  address: nullableText,
  memoTag: nullableShortText,
  accountRef: nullableShortText,
  subaccountRef: nullableShortText,
  contact: nullableText,
  notes: nullableText,
  isDefault: z.boolean().optional().default(false),
});

export type CreateOrganizationRequisiteInput = z.input<
  typeof CreateOrganizationRequisiteInputSchema
>;

export const UpdateOrganizationRequisiteInputSchema = z.object({
  providerId: z.uuid().exactOptional(),
  currencyId: z.uuid().exactOptional(),
  kind: RequisiteKindSchema.exactOptional(),
  label: z.string().trim().min(1).max(255).exactOptional(),
  description: nullableTextPatch,
  beneficiaryName: nullableShortTextPatch,
  institutionName: nullableShortTextPatch,
  institutionCountry: nullableCountryPatch,
  accountNo: nullableShortTextPatch,
  corrAccount: nullableShortTextPatch,
  iban: nullableShortTextPatch,
  bic: nullableShortTextPatch,
  swift: nullableShortTextPatch,
  bankAddress: nullableTextPatch,
  network: nullableShortTextPatch,
  assetCode: nullableShortTextPatch,
  address: nullableTextPatch,
  memoTag: nullableShortTextPatch,
  accountRef: nullableShortTextPatch,
  subaccountRef: nullableShortTextPatch,
  contact: nullableTextPatch,
  notes: nullableTextPatch,
  isDefault: z.boolean().exactOptional(),
});

export type UpdateOrganizationRequisiteInput = z.input<
  typeof UpdateOrganizationRequisiteInputSchema
>;

export const UpsertOrganizationRequisiteAccountingBindingInputSchema = z.object(
  {
    postingAccountNo: z
      .string()
      .trim()
      .regex(/^[0-9]{4}$/),
  },
);

export type UpsertOrganizationRequisiteAccountingBindingInput = z.infer<
  typeof UpsertOrganizationRequisiteAccountingBindingInputSchema
>;
