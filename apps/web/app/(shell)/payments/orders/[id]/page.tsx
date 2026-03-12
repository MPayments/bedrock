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
          <CardTitle>Workflow details</CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-sm">
          <div className="text-muted-foreground">
            Provider execution is currently disabled for this flow.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
