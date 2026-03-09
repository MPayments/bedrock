import type { z } from "zod";

import { createListQuerySchemaFromContract } from "@bedrock/common/pagination";

import { LEDGER_OPERATIONS_LIST_CONTRACT } from "./operations-list-contract";

export const ListLedgerOperationsQuerySchema = createListQuerySchemaFromContract(
  LEDGER_OPERATIONS_LIST_CONTRACT,
);

export type ListLedgerOperationsQuery = z.infer<
  typeof ListLedgerOperationsQuerySchema
>;
