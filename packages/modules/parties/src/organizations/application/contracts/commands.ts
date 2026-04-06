import { z } from "zod";

import { trimToNull } from "@bedrock/shared/core";

import { PartyLegalEntityBundleInputSchema } from "../../../legal-entities/application/contracts";
import { CountryCodeSchema, PartyKindSchema } from "../../domain/party-kind";

export const CreateOrganizationInputSchema = z.object({
  kind: PartyKindSchema.default("legal_entity"),
  shortName: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  fullName: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  country: CountryCodeSchema.nullish().transform((value) => value ?? null),
  externalId: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  description: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  isActive: z.boolean().default(true),
  signatureKey: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  sealKey: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  legalEntity: PartyLegalEntityBundleInputSchema.nullish().transform(
    (value) => value ?? null,
  ),
}).superRefine((value, ctx) => {
  if (value.kind === "legal_entity" && !value.legalEntity) {
    ctx.addIssue({
      code: "custom",
      path: ["legalEntity"],
      message: "legalEntity is required for legal entities",
    });
  }

  if (
    value.kind === "individual" &&
    (!value.shortName || !value.fullName)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["shortName"],
      message: "shortName and fullName are required for individuals",
    });
  }
});

export type CreateOrganizationInput = z.input<
  typeof CreateOrganizationInputSchema
>;

export const UpdateOrganizationInputSchema = z.object({
  externalId: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
  description: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
  isActive: z.boolean().exactOptional(),
  signatureKey: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
  sealKey: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
});

export type UpdateOrganizationInput = z.input<
  typeof UpdateOrganizationInputSchema
>;
