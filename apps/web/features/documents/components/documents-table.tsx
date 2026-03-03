"use client";

import { useRouter } from "next/navigation";

import { EntityTableShell } from "@/components/entities/entity-table-shell";
import type { DocumentDto } from "@/features/operations/documents/lib/schemas";

import { getDocumentColumns } from "./columns";

export function DocumentsTable({
  promise,
  routeBasePath,
}: {
  promise: Promise<{
    data: DocumentDto[];
    total: number;
    limit: number;
    offset: number;
  }>;
  routeBasePath?: string;
}) {
  const router = useRouter();
  const resolvedRouteBasePath = routeBasePath ?? "/operations";

  return (
    <EntityTableShell
      promise={promise}
      columns={getDocumentColumns({ routeBasePath: resolvedRouteBasePath })}
      getRowId={(row) => row.id}
      initialState={{
        sorting: [{ id: "occurredAt", desc: true }],
      }}
      onRowDoubleClick={(row) => {
        router.push(
          `${resolvedRouteBasePath}/${row.original.docType}/${row.original.id}`,
        );
      }}
    />
  );
}
