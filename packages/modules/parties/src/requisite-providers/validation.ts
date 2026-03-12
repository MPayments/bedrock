import { z } from "zod";

import { ValidationError } from "@bedrock/common/errors";
import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/common/pagination";

import {
  CountryAlpha2Schema,
  RequisiteKindSchema,
} from "../internal/requisites-shared";

export const RequisiteProviderSchema = z.object({
  id: z.uuid(),
  kind: RequisiteKindSchema,
  name: z.string(),
  description: z.string().nullable(),
  country: z.string().nullable(),
  address: z.string().nullable(),
  contact: z.string().nullable(),
  bic: z.string().nullable(),
  swift: z.string().nullable(),
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type RequisiteProvider = z.infer<typeof RequisiteProviderSchema>;

const REQUISITE_PROVIDERS_SORTABLE_COLUMNS = [
  "name",
  "kind",
  "country",
  "createdAt",
  "updatedAt",
] as const;

interface RequisiteProvidersListFilters {
  kind: { kind: "string"; cardinality: "multi" };
  country: { kind: "string"; cardinality: "multi" };
  name: { kind: "string"; cardinality: "single" };
}

export const REQUISITE_PROVIDERS_LIST_CONTRACT: ListQueryContract<
  typeof REQUISITE_PROVIDERS_SORTABLE_COLUMNS,
  RequisiteProvidersListFilters
> = {
  sortableColumns: REQUISITE_PROVIDERS_SORTABLE_COLUMNS,
  defaultSort: { id: "createdAt", desc: true },
  filters: {
    kind: { kind: "string", cardinality: "multi" },
    country: { kind: "string", cardinality: "multi" },
    name: { kind: "string", cardinality: "single" },
  },
};

export const ListRequisiteProvidersQuerySchema =
  createListQuerySchemaFromContract(REQUISITE_PROVIDERS_LIST_CONTRACT);

export type ListRequisiteProvidersQuery = z.infer<
  typeof ListRequisiteProvidersQuerySchema
>;

const optionalText = z.string().trim().max(500).nullish();
const optionalShortText = z.string().trim().max(255).nullish();
const optionalCountry = CountryAlpha2Schema.nullish();

const providerFieldsSchema = z.object({
  kind: RequisiteKindSchema,
  name: z.string().trim().min(1).max(255),
  description: optionalText,
  country: optionalCountry,
  address: optionalText,
  contact: optionalText,
  bic: optionalShortText,
  swift: optionalShortText,
});

function refineProviderRules(
  value: {
    kind: string;
    country?: string | null;
    bic?: string | null;
    swift?: string | null;
  },
  ctx: z.RefinementCtx,
) {
  if (value.kind === "bank" || value.kind === "exchange" || value.kind === "custodian") {
    if (!value.country) {
      ctx.addIssue({
        code: "custom",
        path: ["country"],
        message: `country is required for ${value.kind} providers`,
      });
    }
  }

  if (value.kind === "bank") {
    if (value.country === "RU") {
      if (!value.bic) {
        ctx.addIssue({
          code: "custom",
          path: ["bic"],
          message: "bic is required for Russian banks",
        });
      }
    } else if (value.country) {
      if (!value.swift) {
        ctx.addIssue({
          code: "custom",
          path: ["swift"],
          message: "swift is required for non-Russian banks",
        });
      }
    }
  } else {
    if (value.bic) {
      ctx.addIssue({
        code: "custom",
        path: ["bic"],
        message: "bic is only allowed for bank providers",
      });
    }
    if (value.swift && value.kind === "blockchain") {
      ctx.addIssue({
        code: "custom",
        path: ["swift"],
        message: "swift is not applicable for blockchain providers",
      });
    }
  }
}

export const CreateRequisiteProviderInputSchema =
  providerFieldsSchema.superRefine(refineProviderRules);
export type CreateRequisiteProviderInput = z.infer<
  typeof CreateRequisiteProviderInputSchema
>;

export const UpdateRequisiteProviderInputSchema = z
  .object({
    kind: RequisiteKindSchema.optional(),
    name: z.string().trim().min(1).max(255).optional(),
    description: optionalText.optional(),
    country: optionalCountry.optional(),
    address: optionalText.optional(),
    contact: optionalText.optional(),
    bic: optionalShortText.optional(),
    swift: optionalShortText.optional(),
  })
  .superRefine((value, ctx) => {
    const kind = value.kind;
    if (!kind) {
      return;
    }
    refineProviderRules(
      {
        kind,
        country: value.country,
        bic: value.bic,
        swift: value.swift,
      },
      ctx,
    );
  });
export type UpdateRequisiteProviderInput = z.infer<
  typeof UpdateRequisiteProviderInputSchema
>;

export function validateMergedRequisiteProviderState(input: {
  kind: string;
  country?: string | null;
  bic?: string | null;
  swift?: string | null;
}) {
  const result = CreateRequisiteProviderInputSchema.safeParse({
    kind: input.kind,
    name: "x",
    description: null,
    country: input.country ?? null,
    address: null,
    contact: null,
    bic: input.bic ?? null,
    swift: input.swift ?? null,
  });

  if (!result.success) {
    throw new ValidationError(
      result.error.issues.map((issue) => issue.message).join("; "),
    );
  }
}
