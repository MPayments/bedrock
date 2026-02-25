import { notFound } from "next/navigation";

import { Badge } from "@bedrock/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bedrock/ui/components/table";

import { formatDate } from "@/lib/format";

import { getOperationById } from "../lib/queries";

interface OperationDetailsPageProps {
  params: Promise<{ operationId: string }>;
}

function statusVariant(status: "pending" | "posted" | "failed") {
  if (status === "posted") return "default" as const;
  if (status === "pending") return "secondary" as const;
  return "destructive" as const;
}

export default async function OperationDetailsPage({
  params,
}: OperationDetailsPageProps) {
  const { operationId } = await params;
  const details = await getOperationById(operationId);

  if (!details) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Операция {details.operation.id}</CardTitle>
          <CardDescription>
            Статус outbox/posting и состав проводок ledger.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-muted-foreground text-sm">Status</div>
              <div className="mt-1">
                <Badge variant={statusVariant(details.operation.status)}>
                  {details.operation.status}
                </Badge>
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-sm">Operation code</div>
              <div className="mt-1 font-medium">{details.operation.operationCode}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-sm">Source</div>
              <div className="mt-1">
                {details.operation.sourceType} / {details.operation.sourceId}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-sm">Created</div>
              <div className="mt-1">{formatDate(details.operation.createdAt)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-sm">Posted</div>
              <div className="mt-1">
                {details.operation.postedAt ? formatDate(details.operation.postedAt) : "—"}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-sm">Outbox attempts</div>
              <div className="mt-1">{details.operation.outboxAttempts}</div>
            </div>
          </div>
          {details.operation.error ? (
            <p className="text-destructive mt-4 text-sm">{details.operation.error}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Проводки</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Line</TableHead>
                <TableHead>Book Org</TableHead>
                <TableHead>Dr</TableHead>
                <TableHead>Cr</TableHead>
                <TableHead>Posting code</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead className="text-right">Amount minor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {details.postings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground h-16 text-center">
                    Для операции нет posting lines
                  </TableCell>
                </TableRow>
              ) : (
                details.postings.map((posting) => (
                  <TableRow key={posting.id}>
                    <TableCell>{posting.lineNo}</TableCell>
                    <TableCell>
                      {posting.bookOrgName ?? posting.bookOrgId}
                    </TableCell>
                    <TableCell>{posting.debitAccountNo ?? posting.debitBookAccountId}</TableCell>
                    <TableCell>{posting.creditAccountNo ?? posting.creditBookAccountId}</TableCell>
                    <TableCell>{posting.postingCode}</TableCell>
                    <TableCell>{posting.currency}</TableCell>
                    <TableCell className="text-right">{posting.amountMinor}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>TB Plan</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Line</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Transfer ID</TableHead>
                <TableHead>Pending ID</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {details.tbPlans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground h-16 text-center">
                    Для операции нет TB plan lines
                  </TableCell>
                </TableRow>
              ) : (
                details.tbPlans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>{plan.lineNo}</TableCell>
                    <TableCell>{plan.type}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(plan.status)}>{plan.status}</Badge>
                    </TableCell>
                    <TableCell>{plan.transferId}</TableCell>
                    <TableCell>{plan.pendingId ?? "—"}</TableCell>
                    <TableCell className="text-right">{plan.amount}</TableCell>
                    <TableCell className="text-destructive text-xs">
                      {plan.error ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
