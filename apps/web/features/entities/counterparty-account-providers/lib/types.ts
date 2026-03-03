import type { z } from "zod";

import type { CounterpartyAccountProviderSchema } from "@bedrock/core/counterparty-accounts/contracts";

import type { ListResult } from "@/features/entities/shared/lib/list-result";

type AccountProvider = z.infer<typeof CounterpartyAccountProviderSchema>;

export type SerializedProvider = Omit<
  AccountProvider,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

export type ProvidersListResult = ListResult<SerializedProvider>;
