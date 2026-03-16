import type { ListResult } from "@/features/entities/shared/lib/list-result";

export type CurrencyListItem = {
  id: string;
  name: string;
  code: string;
  symbol: string;
  precision: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CurrenciesListResult = ListResult<CurrencyListItem>;
