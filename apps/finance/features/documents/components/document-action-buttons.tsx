"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@bedrock/sdk-ui/components/button";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import {
  approveDocument,
  postDocument,
  rejectDocument,
  repostDocument,
  resolveDealReconciliationExceptionWithAdjustmentDocument,
  submitDocument,
  voidDocument,
} from "@/features/operations/documents/lib/mutations";

type DocumentActionButtonsProps = {
  docType: string;
  documentId: string;
  allowedActions: string[];
  reconciliationAdjustment?: {
    dealId: string;
    exceptionId: string;
    returnToHref?: string;
  };
};

type ActionButtonConfig = {
  actionId: "submit" | "approve" | "reject" | "post" | "cancel" | "repost";
  label: string;
  pendingLabel: string;
  title: string;
  variant?: "default" | "outline" | "destructive";
  execute: () => Promise<{ ok: boolean; message?: string }>;
};

export function DocumentActionButtons({
  docType,
  documentId,
  allowedActions,
  reconciliationAdjustment,
}: DocumentActionButtonsProps) {
  const router = useRouter();
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const actionButtons: ActionButtonConfig[] = [];

  if (allowedActions.includes("submit")) {
    actionButtons.push({
      actionId: "submit",
      label: "Отправить",
      pendingLabel: "Отправка...",
      title: "отправка",
      variant: "outline",
      execute: () => submitDocument({ docType, documentId }),
    });
  }

  if (allowedActions.includes("approve")) {
    actionButtons.push({
      actionId: "approve",
      label: "Согласовать",
      pendingLabel: "Согласование...",
      title: "согласование",
      variant: "outline",
      execute: () => approveDocument({ docType, documentId }),
    });

    actionButtons.push({
      actionId: "reject",
      label: "Отклонить",
      pendingLabel: "Отклонение...",
      title: "отклонение",
      variant: "destructive",
      execute: () => rejectDocument({ docType, documentId }),
    });
  }

  if (allowedActions.includes("post")) {
    actionButtons.push({
      actionId: "post",
      label: "Провести",
      pendingLabel: "Проведение...",
      title: "проведение",
      execute: () => postDocument({ docType, documentId }),
    });
  }

  if (allowedActions.includes("cancel")) {
    actionButtons.push({
      actionId: "cancel",
      label: "Отменить",
      pendingLabel: "Отмена...",
      title: "отмена",
      variant: "destructive",
      execute: () => voidDocument({ docType, documentId }),
    });
  }

  if (allowedActions.includes("repost")) {
    actionButtons.push({
      actionId: "repost",
      label: "Перепровести",
      pendingLabel: "Перепроведение...",
      title: "перепроведение",
      variant: "outline",
      execute: () => repostDocument({ docType, documentId }),
    });
  }

  if (actionButtons.length === 0) {
    return null;
  }

  async function runAction(input: ActionButtonConfig) {
    setActiveAction(input.actionId);

    const result = await input.execute();

    if (!result.ok) {
      toast.error(
        result.message ?? `Не удалось выполнить действие ${input.title}`,
      );
      setActiveAction(null);
      return;
    }

    if (input.actionId === "post" && reconciliationAdjustment) {
      const resolution =
        await resolveDealReconciliationExceptionWithAdjustmentDocument({
          dealId: reconciliationAdjustment.dealId,
          docType,
          documentId,
          exceptionId: reconciliationAdjustment.exceptionId,
        });

      if (!resolution.ok) {
        toast.error(resolution.message);
        setActiveAction(null);
        router.refresh();
        return;
      }

      toast.success("Документ проведен, исключение сверки разрешено");
      setActiveAction(null);

      if (reconciliationAdjustment.returnToHref) {
        router.push(reconciliationAdjustment.returnToHref);
        return;
      }

      router.refresh();
      return;
    }

    toast.success(`Документ: ${input.title}`);
    setActiveAction(null);
    router.refresh();
  }

  return (
    <div className="flex w-full flex-wrap justify-start gap-2 md:w-auto md:justify-end">
      {actionButtons.map((action) => (
        <Button
          key={action.actionId}
          data-testid={`finance-document-action-${action.actionId}`}
          type="button"
          size="lg"
          variant={action.variant}
          disabled={activeAction !== null}
          onClick={() => void runAction(action)}
        >
          {activeAction === action.actionId
            ? action.pendingLabel
            : action.label}
        </Button>
      ))}
    </div>
  );
}
