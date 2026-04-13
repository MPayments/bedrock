"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { getClientColumns } from "@bedrock/sdk-clients-ui/components/client-columns";

import type { SerializedCustomer } from "@/features/entities/customers/lib/types";
import { CustomerRowActions } from "./customer-row-actions";

export function getColumns(): ColumnDef<SerializedCustomer>[] {
  return getClientColumns({
    renderActions: (client) => (
      <CustomerRowActions customer={client as SerializedCustomer} />
    ),
  }) as ColumnDef<SerializedCustomer>[];
}
