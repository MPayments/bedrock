import type { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

export const BANK_DETAILS_LIST_CONTRACT = {
  sortableColumns: ["name", "bankName", "createdAt"] as const,
  defaultSort: { id: "name" as const, desc: false },
  filters: {
    organizationId: { kind: "number" as const, cardinality: "single" as const },
    isActive: { kind: "boolean" as const, cardinality: "single" as const },
  },
} satisfies ListQueryContract<
  readonly ["name", "bankName", "createdAt"],
  any
>;

export const ListBankDetailsQuerySchema = createListQuerySchemaFromContract(
  BANK_DETAILS_LIST_CONTRACT,
);

export type ListBankDetailsQuery = z.infer<typeof ListBankDetailsQuerySchema>;
