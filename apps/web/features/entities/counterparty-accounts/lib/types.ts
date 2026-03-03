import type { z } from "zod";

import type { CounterpartyAccountSchema } from "@bedrock/core/counterparty-accounts/contracts";

import type { ListResult } from "@/features/entities/shared/lib/list-result";

type Account = z.infer<typeof CounterpartyAccountSchema>;

export type SerializedAccount = Omit<Account, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
  currencyDisplay?: string;
};

export type AccountsListResult = ListResult<SerializedAccount>;

export type CurrencyFilterOption = {
  value: string;
  label: string;
};
