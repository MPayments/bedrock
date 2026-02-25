"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@bedrock/ui/components/button";
import { toast } from "@bedrock/ui/components/sonner";

import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";
import type { TransferDto } from "../lib/queries";

interface TransferActionsClientProps {
  transfer: TransferDto;
}

function createIdempotencyKey(prefix: string) {
  const random =
    typeof crypto !== "undefined"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}:${random}`;
}

export function TransferActionsClient({ transfer }: TransferActionsClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleApprove() {
    setLoading(true);
    const result = await executeMutation({
      request: () =>
        apiClient.v1.transfers[":id"].approve.$post({
          param: { id: transfer.id },
          json: {
            occurredAt: new Date().toISOString(),
          },
        }),
      fallbackMessage: "Не удалось подтвердить перевод",
      parseData: async () => undefined,
    });
    setLoading(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Перевод подтвержден");
    router.refresh();
  }

  async function handleReject() {
    const reason = window.prompt("Причина отклонения");
    if (reason === null) return;
    if (reason.trim().length === 0) {
      toast.error("Причина отклонения обязательна");
      return;
    }

    setLoading(true);
    const result = await executeMutation({
      request: () =>
        apiClient.v1.transfers[":id"].reject.$post({
          param: { id: transfer.id },
          json: {
            occurredAt: new Date().toISOString(),
            reason,
          },
        }),
      fallbackMessage: "Не удалось отклонить перевод",
      parseData: async () => undefined,
    });
    setLoading(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Перевод отклонен");
    router.refresh();
  }

  async function handleSettle() {
    setLoading(true);
    const result = await executeMutation({
      request: () =>
        apiClient.v1.transfers[":id"].settle.$post({
          param: { id: transfer.id },
          json: {
            eventIdempotencyKey: createIdempotencyKey("ui:transfer:settle"),
            occurredAt: new Date().toISOString(),
          },
        }),
      fallbackMessage: "Не удалось провести settle",
      parseData: async () => undefined,
    });
    setLoading(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Pending перевод проведен");
    router.refresh();
  }

  async function handleVoid() {
    const reason = window.prompt("Причина void (опционально)");
    if (reason === null) return;

    setLoading(true);
    const result = await executeMutation({
      request: () =>
        apiClient.v1.transfers[":id"].void.$post({
          param: { id: transfer.id },
          json: {
            eventIdempotencyKey: createIdempotencyKey("ui:transfer:void"),
            occurredAt: new Date().toISOString(),
            reason: reason.trim() || undefined,
          },
        }),
      fallbackMessage: "Не удалось выполнить void",
      parseData: async () => undefined,
    });
    setLoading(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Pending перевод аннулирован");
    router.refresh();
  }

  if (transfer.status === "draft") {
    return (
      <div className="flex gap-2">
        <Button size="sm" disabled={loading} onClick={handleApprove}>
          Approve
        </Button>
        <Button size="sm" variant="outline" disabled={loading} onClick={handleReject}>
          Reject
        </Button>
      </div>
    );
  }

  if (transfer.status === "pending") {
    return (
      <div className="flex gap-2">
        <Button size="sm" disabled={loading} onClick={handleSettle}>
          Settle
        </Button>
        <Button size="sm" variant="outline" disabled={loading} onClick={handleVoid}>
          Void
        </Button>
      </div>
    );
  }

  return (
    <p className="text-muted-foreground text-sm">
      Для текущего статуса ручные действия недоступны.
    </p>
  );
}
