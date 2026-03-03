"use client";

import { useRouter } from "next/navigation";

import { EntityTableShell } from "@/components/entities/entity-table-shell";
import type { DocumentDto } from "@/features/operations/documents/lib/queries";

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
        if (row.original.docType === "payment_resolution") {
          router.push("/payments/settlements");
          return;
        }
        router.push(`/operations/${row.original.docType}/${row.original.id}`);
      }}
    />
  );
}
