"use client";

import { useRouter } from "next/navigation";
import type { Row as TanstackRow } from "@tanstack/react-table";
import * as React from "react";

import { EntityTableShell } from "@bedrock/sdk-tables-ui/components/entity-table-shell";

import { getOrganizationColumns } from "@bedrock/sdk-organizations-ui/components/organization-columns";
import type { OrganizationListItem } from "@bedrock/sdk-organizations-ui/lib/contracts";

import type { OrganizationsListResult } from "../lib/types";

const columns = getOrganizationColumns();

type OrganizationsTableProps = {
  promise: Promise<OrganizationsListResult>;
  detailsBasePath?: string;
};

export function OrganizationsTable({
  promise,
  detailsBasePath = "/treasury/organizations",
}: OrganizationsTableProps) {
  const router = useRouter();

  const handleRowDoubleClick = React.useCallback(
    (row: TanstackRow<OrganizationListItem>) => {
      router.push(`${detailsBasePath.replace(/\/+$/, "")}/${row.original.id}`);
    },
    [detailsBasePath, router],
  );

  return (
    <EntityTableShell
      promise={promise as Promise<{ data: OrganizationListItem[]; total: number; limit: number; offset: number }>}
      columns={columns}
      getRowId={(row) => row.id}
      initialState={{
        sorting: [{ id: "updatedAt", desc: true }],
      }}
      onRowDoubleClick={handleRowDoubleClick}
    />
  );
}
