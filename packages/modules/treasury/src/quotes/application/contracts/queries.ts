import { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

import {
  QuotePricingInputSchema,
} from "./zod";

export const PreviewQuoteInputSchema = QuotePricingInputSchema;

const QUOTES_SORTABLE_COLUMNS = [
  "createdAt",
  "expiresAt",
  "usedAt",
  "status",
  "pricingMode",
] as const;

interface QuotesListFilters {
  idempotencyKey: { kind: "string"; cardinality: "single" };
  status: {
    kind: "string";
    cardinality: "multi";
    enumValues: ["active", "used", "expired", "cancelled"];
  };
  pricingMode: {
    kind: "string";
    cardinality: "multi";
    enumValues: ["auto_cross", "explicit_route"];
  };
}

export const QUOTES_LIST_CONTRACT: ListQueryContract<
  typeof QUOTES_SORTABLE_COLUMNS,
  QuotesListFilters
> = {
  sortableColumns: QUOTES_SORTABLE_COLUMNS,
  defaultSort: { id: "createdAt", desc: true },
  filters: {
    idempotencyKey: { kind: "string", cardinality: "single" },
    status: {
      kind: "string",
      cardinality: "multi",
      enumValues: ["active", "used", "expired", "cancelled"],
    },
    pricingMode: {
      kind: "string",
      cardinality: "multi",
      enumValues: ["auto_cross", "explicit_route"],
    },
  },
};

export const ListQuotesQuerySchema = createListQuerySchemaFromContract(
  QUOTES_LIST_CONTRACT,
);

export const GetQuoteDetailsInputSchema = z.object({
  quoteRef: z.string().min(1).max(255),
});

export type PreviewQuoteInput = z.infer<typeof PreviewQuoteInputSchema>;
export type ListQuotesQuery = z.infer<typeof ListQuotesQuerySchema>;
export type GetQuoteDetailsInput = z.infer<typeof GetQuoteDetailsInputSchema>;
