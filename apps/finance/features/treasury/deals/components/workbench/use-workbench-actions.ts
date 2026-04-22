"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { toast } from "@bedrock/sdk-ui/components/sonner";

import type { FinanceDealWorkbench } from "@/features/treasury/deals/lib/queries";
import { executeMutation } from "@/lib/resources/http";

import { createIdempotencyKey, refreshPage } from "./utils";

export interface WorkbenchActions {
  acceptQuote: (quoteId: string) => Promise<void>;
  closeDeal: () => Promise<void>;
  createCalculation: () => Promise<void>;
  createLegOperation: (legId: string) => Promise<void>;
  deleteAttachment: (attachmentId: string) => Promise<void>;
  downloadAttachment: (attachmentId: string) => void;
  ignoreReconciliationException: (exceptionId: string) => Promise<void>;
  requestExecution: () => Promise<void>;
  resolveLeg: (legId: string) => Promise<void>;
  runReconciliation: () => Promise<void>;
}

export interface WorkbenchActionsState {
  deletingAttachmentId: string | null;
  ignoringExceptionId: string | null;
  isAcceptingQuoteId: string | null;
  isClosingDeal: boolean;
  isCreatingCalculation: boolean;
  isCreatingLegOperationId: string | null;
  isRequestingExecution: boolean;
  isResolvingLegId: string | null;
  isRunningReconciliation: boolean;
}

export function useWorkbenchActions(
  deal: FinanceDealWorkbench,
): { actions: WorkbenchActions; state: WorkbenchActionsState } {
  const router = useRouter();
  const [isCreatingCalculation, setIsCreatingCalculation] = useState(false);
  const [isAcceptingQuoteId, setIsAcceptingQuoteId] = useState<string | null>(
    null,
  );
  const [isClosingDeal, setIsClosingDeal] = useState(false);
  const [isCreatingLegOperationId, setIsCreatingLegOperationId] = useState<
    string | null
  >(null);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<
    string | null
  >(null);
  const [isRequestingExecution, setIsRequestingExecution] = useState(false);
  const [isRunningReconciliation, setIsRunningReconciliation] = useState(false);
  const [isResolvingLegId, setIsResolvingLegId] = useState<string | null>(null);
  const [ignoringExceptionId, setIgnoringExceptionId] = useState<string | null>(
    null,
  );

  const dealId = encodeURIComponent(deal.summary.id);

  async function acceptQuote(quoteId: string) {
    setIsAcceptingQuoteId(quoteId);
    const result = await executeMutation({
      fallbackMessage: "Не удалось принять котировку",
      request: () =>
        fetch(
          `/v1/deals/${dealId}/quotes/${encodeURIComponent(quoteId)}/accept`,
          {
            method: "POST",
            credentials: "include",
          },
        ),
    });
    setIsAcceptingQuoteId(null);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Котировка принята");
    refreshPage(router);
  }

  async function createCalculation() {
    if (!deal.acceptedQuote) {
      toast.error("Сначала примите котировку");
      return;
    }

    setIsCreatingCalculation(true);
    const result = await executeMutation({
      fallbackMessage: "Не удалось создать расчет",
      request: () =>
        fetch(`/v1/deals/${dealId}/calculations/from-quote`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": createIdempotencyKey(),
          },
          body: JSON.stringify({
            quoteId: deal.acceptedQuote?.quoteId,
          }),
        }),
    });
    setIsCreatingCalculation(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Расчет создан");
    refreshPage(router);
  }

  async function deleteAttachment(attachmentId: string) {
    setDeletingAttachmentId(attachmentId);
    const result = await executeMutation({
      fallbackMessage: "Не удалось удалить вложение",
      request: () =>
        fetch(
          `/v1/deals/${dealId}/attachments/${encodeURIComponent(attachmentId)}`,
          {
            method: "DELETE",
            credentials: "include",
          },
        ),
    });
    setDeletingAttachmentId(null);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Вложение удалено");
    refreshPage(router);
  }

  function downloadAttachment(attachmentId: string) {
    window.open(
      `/v1/deals/${dealId}/attachments/${encodeURIComponent(attachmentId)}/download`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function requestExecution() {
    setIsRequestingExecution(true);
    const result = await executeMutation({
      fallbackMessage: "Не удалось запросить исполнение",
      request: () =>
        fetch(`/v1/deals/${dealId}/execution/request`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": createIdempotencyKey(),
          },
          body: JSON.stringify({}),
        }),
    });
    setIsRequestingExecution(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Исполнение запрошено");
    refreshPage(router);
  }

  async function createLegOperation(legId: string) {
    setIsCreatingLegOperationId(legId);
    const result = await executeMutation({
      fallbackMessage: "Не удалось создать операцию по шагу",
      request: () =>
        fetch(
          `/v1/deals/${dealId}/execution/legs/${encodeURIComponent(legId)}/operation`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": createIdempotencyKey(),
            },
            body: JSON.stringify({}),
          },
        ),
    });
    setIsCreatingLegOperationId(null);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Операция по шагу создана");
    refreshPage(router);
  }

  async function resolveLeg(legId: string) {
    setIsResolvingLegId(legId);
    const result = await executeMutation({
      fallbackMessage: "Не удалось устранить блокер шага",
      request: () =>
        fetch(`/v1/deals/${dealId}/execution/blockers/resolve`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": createIdempotencyKey(),
          },
          body: JSON.stringify({
            legId,
          }),
        }),
    });
    setIsResolvingLegId(null);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Блокер шага устранён");
    refreshPage(router);
  }

  async function runReconciliation() {
    setIsRunningReconciliation(true);
    const result = await executeMutation({
      fallbackMessage: "Не удалось повторить сверку",
      request: () =>
        fetch(`/v1/deals/${dealId}/reconciliation/run`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Idempotency-Key": createIdempotencyKey(),
          },
        }),
    });
    setIsRunningReconciliation(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Сверка обновлена");
    refreshPage(router);
  }

  async function ignoreReconciliationException(exceptionId: string) {
    setIgnoringExceptionId(exceptionId);
    const result = await executeMutation({
      fallbackMessage: "Не удалось игнорировать исключение сверки",
      request: () =>
        fetch(
          `/v1/deals/${dealId}/reconciliation/exceptions/${encodeURIComponent(exceptionId)}/ignore`,
          {
            method: "POST",
            credentials: "include",
          },
        ),
    });
    setIgnoringExceptionId(null);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Исключение сверки помечено как игнорируемое");
    refreshPage(router);
  }

  async function closeDeal() {
    setIsClosingDeal(true);
    const result = await executeMutation({
      fallbackMessage: "Не удалось закрыть сделку",
      request: () =>
        fetch(`/v1/deals/${dealId}/close`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": createIdempotencyKey(),
          },
          body: JSON.stringify({}),
        }),
    });
    setIsClosingDeal(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Сделка закрыта");
    refreshPage(router);
  }

  return {
    actions: {
      acceptQuote,
      closeDeal,
      createCalculation,
      createLegOperation,
      deleteAttachment,
      downloadAttachment,
      ignoreReconciliationException,
      requestExecution,
      resolveLeg,
      runReconciliation,
    },
    state: {
      deletingAttachmentId,
      ignoringExceptionId,
      isAcceptingQuoteId,
      isClosingDeal,
      isCreatingCalculation,
      isCreatingLegOperationId,
      isRequestingExecution,
      isResolvingLegId,
      isRunningReconciliation,
    },
  };
}
