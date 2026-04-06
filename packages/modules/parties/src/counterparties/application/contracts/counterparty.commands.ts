import { z } from "zod";

import { PartyLegalEntityBundleInputSchema } from "../../../legal-entities/application/contracts";
import {
  CountryCodeSchema,
  PartyKindSchema,
} from "../../../shared/domain/party-kind";
import { CounterpartyRelationshipKindSchema } from "../../domain/relationship-kind";

function trimToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const CreateCounterpartyInputSchema = z.object({
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
  relationshipKind: CounterpartyRelationshipKindSchema.default("external"),
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
  customerId: z
    .uuid()
    .nullish()
    .transform((value) => value ?? null),
  groupIds: z.array(z.uuid()).default([]),
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

export type CreateCounterpartyInput = z.input<
  typeof CreateCounterpartyInputSchema
>;

export const UpdateCounterpartyInputSchema = z.object({
  relationshipKind: CounterpartyRelationshipKindSchema.exactOptional(),
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
  customerId: z.uuid().nullable().exactOptional(),
  groupIds: z.array(z.uuid()).exactOptional(),
});

export type UpdateCounterpartyInput = z.input<
  typeof UpdateCounterpartyInputSchema
>;
