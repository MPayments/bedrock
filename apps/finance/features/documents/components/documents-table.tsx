"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { EntityTableShell } from "@bedrock/sdk-tables-ui/components/entity-table-shell";
import type { DocumentDto } from "@/features/operations/documents/lib/schemas";
import { buildDocumentDetailsHref } from "@/features/documents/lib/routes";
import type { Option } from "@bedrock/sdk-tables-ui/lib/types";

import { getDocumentColumns } from "./columns";

export function DocumentsTable({
  promise,
  docTypeOptions = [],
  routeBasePath,
}: {
  promise: Promise<{
    data: DocumentDto[];
    total: number;
    limit: number;
    offset: number;
  }>;
  docTypeOptions?: Option[];
  routeBasePath?: string;
}) {
  void routeBasePath;
  const router = useRouter();
  const columns = React.useMemo(
    () => getDocumentColumns(docTypeOptions),
    [docTypeOptions],
  );

  return (
    <EntityTableShell
      promise={promise}
      columns={columns}
      getRowId={(row) => row.id}
      initialState={{
        sorting: [{ id: "occurredAt", desc: true }],
      }}
      onRowDoubleClick={(row) => {
        const href = buildDocumentDetailsHref(
          row.original.docType,
          row.original.id,
        );
        if (!href) {
          return;
        }

        router.push(href);
      }}
    />
  );
}
