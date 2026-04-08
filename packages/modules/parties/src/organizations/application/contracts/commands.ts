import { z } from "zod";

import { trimToNull } from "@bedrock/shared/core";

import { PartyProfileBundleInputSchema } from "../../../party-profiles/application/contracts";
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
  externalRef: z
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
  partyProfile: PartyProfileBundleInputSchema.nullish().transform(
    (value) => value ?? null,
  ),
}).superRefine((value, ctx) => {
  if (value.kind === "legal_entity" && !value.partyProfile) {
    ctx.addIssue({
      code: "custom",
      path: ["partyProfile"],
      message: "partyProfile is required for legal entities",
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
  shortName: z.string().trim().min(1).exactOptional(),
  fullName: z.string().trim().min(1).exactOptional(),
  country: CountryCodeSchema.nullable().exactOptional(),
  externalRef: z
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
