"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge } from "@bedrock/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bedrock/ui/components/table";

import { formatDate } from "@/lib/format";

import type { OperationSummaryDto } from "../lib/queries";

interface OperationsJournalTableProps {
  operations: OperationSummaryDto[];
  emptyMessage?: string;
}

function statusMeta(status: OperationSummaryDto["status"]) {
  if (status === "posted") return { label: "Posted", variant: "default" as const };
  if (status === "pending") return { label: "Pending", variant: "secondary" as const };
  return { label: "Failed", variant: "destructive" as const };
}

export function OperationsJournalTable({
  operations,
  emptyMessage = "Операции не найдены",
}: OperationsJournalTableProps) {
  const router = useRouter();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Operation</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Code</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Postings</TableHead>
          <TableHead>Currencies</TableHead>
          <TableHead className="text-right">Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {operations.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-muted-foreground h-20 text-center">
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : (
          operations.map((operation) => {
            const status = statusMeta(operation.status);
            return (
              <TableRow
                key={operation.id}
                className="cursor-pointer"
                onDoubleClick={() => router.push(`/operations/journal/${operation.id}`)}
              >
                <TableCell className="font-medium">
                  <Link href={`/operations/journal/${operation.id}`} className="underline">
                    {operation.id.slice(0, 8)}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <div>{operation.sourceType}</div>
                    <div className="text-muted-foreground text-xs">{operation.sourceId}</div>
                  </div>
                </TableCell>
                <TableCell>{operation.operationCode}</TableCell>
                <TableCell>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                <TableCell className="text-right">{operation.postingCount}</TableCell>
                <TableCell>{operation.currencies.join(", ") || "—"}</TableCell>
                <TableCell className="text-right text-xs">
                  {formatDate(operation.createdAt)}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
