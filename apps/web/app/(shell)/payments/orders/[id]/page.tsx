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

import {
  getApprovalStatusLabel,
  getLifecycleStatusLabel,
  getPostingStatusLabel,
  getSubmissionStatusLabel,
} from "@/features/documents/lib/status-labels";
import { getPaymentDetails } from "@/features/payments/lib/api";
import { formatAmountByCurrency, formatDate } from "@/lib/format";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PaymentIntentDetailsPage({ params }: PageProps) {
  const { id } = await params;
  const details = await getPaymentDetails(id);

  if (!details) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle className="text-2xl">{details.document.docNo}</CardTitle>
          <CardDescription>{details.document.title}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 py-6 text-sm md:grid-cols-2">
          <div className="space-y-2">
            <div>
              <span className="text-muted-foreground">Тип:</span>{" "}
              {details.document.docType}
            </div>
            <div>
              <span className="text-muted-foreground">Сумма:</span>{" "}
              {details.document.amount
                ? formatAmountByCurrency(
                    details.document.amount,
                    details.document.currency,
                  )
                : "—"}{" "}
              {details.document.currency ?? ""}
            </div>
            <div>
              <span className="text-muted-foreground">Создан:</span>{" "}
              {formatDate(details.document.createdAt)}
            </div>
          </div>
          <div className="flex flex-wrap content-start gap-2">
            <Badge variant="outline">
              {getSubmissionStatusLabel(details.document.submissionStatus)}
            </Badge>
            <Badge variant="outline">
              {getApprovalStatusLabel(details.document.approvalStatus)}
            </Badge>
            <Badge variant="outline">
              {getPostingStatusLabel(details.document.postingStatus)}
            </Badge>
            <Badge variant="outline">
              {getLifecycleStatusLabel(details.document.lifecycleStatus)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Connector intent</CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-sm">
          {details.connectorIntent ? (
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <span className="text-muted-foreground">ID:</span>{" "}
                {details.connectorIntent.id}
              </div>
              <div>
                <span className="text-muted-foreground">Статус:</span>{" "}
                {details.connectorIntent.status}
              </div>
              <div>
                <span className="text-muted-foreground">Направление:</span>{" "}
                {details.connectorIntent.direction}
              </div>
              <div>
                <span className="text-muted-foreground">Коридор:</span>{" "}
                {details.connectorIntent.corridor ?? "—"}
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground">
              Connector intent еще не создан.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Попытки провайдера</CardTitle>
        </CardHeader>
        <CardContent className="py-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>External ref</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {details.attempts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-muted-foreground h-12 text-center"
                  >
                    Попыток пока нет.
                  </TableCell>
                </TableRow>
              ) : (
                details.attempts.map((attempt) => (
                  <TableRow key={attempt.id}>
                    <TableCell>{attempt.attemptNo}</TableCell>
                    <TableCell>{attempt.providerCode}</TableCell>
                    <TableCell>{attempt.providerRoute ?? "—"}</TableCell>
                    <TableCell>{attempt.status}</TableCell>
                    <TableCell>{attempt.externalAttemptRef ?? "—"}</TableCell>
                    <TableCell>{formatDate(attempt.updatedAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>События провайдера</CardTitle>
        </CardHeader>
        <CardContent className="py-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Signature</TableHead>
                <TableHead>Error</TableHead>
                <TableHead>Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {details.events.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-muted-foreground h-12 text-center"
                  >
                    Событий пока нет.
                  </TableCell>
                </TableRow>
              ) : (
                details.events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>{event.providerCode}</TableCell>
                    <TableCell>{event.eventType}</TableCell>
                    <TableCell>{event.status ?? event.parseStatus ?? "—"}</TableCell>
                    <TableCell>
                      {event.signatureValid ? "valid" : "invalid"}
                    </TableCell>
                    <TableCell>{event.error ?? "—"}</TableCell>
                    <TableCell>{formatDate(event.receivedAt)}</TableCell>
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
