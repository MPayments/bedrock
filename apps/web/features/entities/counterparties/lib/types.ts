import type { Counterparty } from "@bedrock/app/counterparties/contracts";

import type { ListResult } from "@/features/entities/shared/lib/list-result";

export type SerializedCounterparty = Omit<
  Counterparty,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

export type CounterpartiesListResult = ListResult<SerializedCounterparty>;
