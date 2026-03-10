"use client";

import { useRouter } from "next/navigation";

import { EntityTableShell } from "@/components/entities/entity-table-shell";
import type { DocumentDto } from "@/features/operations/documents/lib/schemas";
import { buildDocumentDetailsHref } from "@/features/documents/lib/routes";

import { getDocumentColumns } from "./columns";

export function DocumentsTable({
  promise,
}: {
  promise: Promise<{
    data: DocumentDto[];
    total: number;
    limit: number;
    offset: number;
  }>;
}) {
  const router = useRouter();

  return (
    <EntityTableShell
      promise={promise}
      columns={getDocumentColumns()}
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
