"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@bedrock/ui/components/button";
import { toast } from "@bedrock/ui/components/sonner";

import { executeMutation } from "@/lib/resources/http";
import type { DocumentDetailsDto, DocumentDto } from "@/app/(shell)/operations/lib/queries";

function createIdempotencyKey(prefix: string) {
  const random =
    typeof crypto !== "undefined"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return `${prefix}:${random}`;
}

async function runDocAction(
  request: () => Promise<Response>,
  fallbackMessage: string,
) {
  return executeMutation({
    request,
    fallbackMessage,
    parseData: async () => undefined,
  });
}

export function DocumentActionsClient({
  details,
}: {
  details: DocumentDetailsDto;
}) {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const document = details.document;

  async function handleAction(
    action: "submit" | "approve" | "reject" | "post" | "cancel",
    successMessage: string,
    fallbackMessage: string,
  ) {
    setLoading(true);
    const result = await runDocAction(
      () =>
        fetch(`${apiBaseUrl}/v1/docs/${document.docType}/${document.id}/${action}`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }),
      fallbackMessage,
    );
    setLoading(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(successMessage);
    router.refresh();
  }

  async function handleResolution(action: "settle" | "void") {
    if (
      document.docType !== "transfer" &&
      document.docType !== "payout_initiate" &&
      document.docType !== "fee_payout_initiate"
    ) {
      return;
    }

    const resolutionDocType =
      document.docType === "transfer"
        ? action === "settle"
          ? "transfer_settle"
          : "transfer_void"
        : document.docType === "payout_initiate"
          ? action === "settle"
            ? "payout_settle"
            : "payout_void"
          : action === "settle"
            ? "fee_payout_settle"
            : "fee_payout_void";

    const payload =
      document.docType === "transfer"
        ? {
            transferDocumentId: document.id,
            eventIdempotencyKey: createIdempotencyKey(
              `ui:transfer:${action}:event`,
            ),
            occurredAt: new Date().toISOString(),
          }
        : document.docType === "payout_initiate"
          ? {
              payoutInitiateDocumentId: document.id,
              payOutCurrency:
                typeof document.payload === "object" &&
                document.payload &&
                "payOutCurrency" in document.payload &&
                typeof document.payload.payOutCurrency === "string"
                  ? document.payload.payOutCurrency
                  : document.currency,
              railRef: createIdempotencyKey(`ui:payout:${action}:rail`),
              occurredAt: new Date().toISOString(),
            }
          : {
              feePayoutInitiateDocumentId: document.id,
              railRef: createIdempotencyKey(`ui:fee-payout:${action}:rail`),
              occurredAt: new Date().toISOString(),
            };

    setLoading(true);
    const createResult = await executeMutation<DocumentDto>({
      request: () =>
        fetch(
          `${apiBaseUrl}/v1/docs/${resolutionDocType}`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              createIdempotencyKey: createIdempotencyKey(
                `ui:${document.docType}:${action}`,
              ),
              input: payload,
            }),
          },
        ),
      fallbackMessage:
        action === "settle"
          ? "Не удалось создать settle документ"
          : "Не удалось создать void документ",
    });

    if (!createResult.ok) {
      setLoading(false);
      toast.error(createResult.message);
      return;
    }

    const created = createResult.data;
    const submitResult = await runDocAction(
      () =>
        fetch(`${apiBaseUrl}/v1/docs/${created.docType}/${created.id}/submit`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }),
      "Не удалось отправить документ",
    );
    if (!submitResult.ok) {
      setLoading(false);
      toast.error(submitResult.message);
      return;
    }

    const postResult = await runDocAction(
      () =>
        fetch(`${apiBaseUrl}/v1/docs/${created.docType}/${created.id}/post`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }),
      "Не удалось провести документ",
    );
    setLoading(false);

    if (!postResult.ok) {
      toast.error(postResult.message);
      return;
    }

    toast.success(
      action === "settle"
        ? "Settle документ создан и отправлен"
        : "Void документ создан и отправлен",
    );
    router.refresh();
  }

  const computed =
    details.computed && typeof details.computed === "object" ? details.computed : null;
  const hasPendingTransfer =
    ["transfer", "payout_initiate", "fee_payout_initiate"].includes(document.docType) &&
    computed &&
    "pendingTransferIds" in computed &&
    Array.isArray(computed.pendingTransferIds) &&
    computed.pendingTransferIds.length > 0;

  return (
    <div className="flex flex-wrap gap-2">
      {document.submissionStatus === "draft" && document.lifecycleStatus === "active" ? (
        <Button disabled={loading} onClick={() => handleAction("submit", "Документ отправлен", "Не удалось отправить документ")}>
          Submit
        </Button>
      ) : null}
      {document.submissionStatus === "submitted" &&
      document.approvalStatus === "pending" ? (
        <>
          <Button
            disabled={loading}
            onClick={() => handleAction("approve", "Документ согласован", "Не удалось согласовать документ")}
          >
            Approve
          </Button>
          <Button
            variant="destructive"
            disabled={loading}
            onClick={() => handleAction("reject", "Документ отклонен", "Не удалось отклонить документ")}
          >
            Reject
          </Button>
        </>
      ) : null}
      {document.submissionStatus === "submitted" &&
      (document.approvalStatus === "approved" ||
        document.approvalStatus === "not_required") &&
      document.postingStatus === "unposted" ? (
        <Button
          disabled={loading}
          onClick={() => handleAction("post", "Документ отправлен в posting", "Не удалось провести документ")}
        >
          Post
        </Button>
      ) : null}
      {["unposted", "failed"].includes(document.postingStatus) &&
      document.lifecycleStatus === "active" ? (
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => handleAction("cancel", "Документ отменен", "Не удалось отменить документ")}
        >
          Cancel
        </Button>
      ) : null}
      {hasPendingTransfer && document.postingStatus === "posted" ? (
        <>
          <Button disabled={loading} onClick={() => handleResolution("settle")}>
            Settle
          </Button>
          <Button
            variant="destructive"
            disabled={loading}
            onClick={() => handleResolution("void")}
          >
            Void
          </Button>
        </>
      ) : null}
    </div>
  );
}
