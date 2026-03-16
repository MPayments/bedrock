import type { Customer } from "@bedrock/parties/contracts";

import type { ListResult } from "@/features/entities/shared/lib/list-result";

export type SerializedCustomer = Omit<Customer, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export type CustomersListResult = ListResult<SerializedCustomer>;
