"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@bedrock/sdk-ui/components/button";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import type { DocumentTransitionMutators } from "../lib/mutations";

type DocumentActionButtonsProps = {
  docType: string;
  documentId: string;
  allowedActions: string[];
  mutators: DocumentTransitionMutators;
  returnOnPostedHref?: string;
  onPostedSuccess?: () => Promise<void> | void;
};

type TransitionAction =
  | "submit"
  | "approve"
  | "reject"
  | "post"
  | "cancel"
  | "repost";

type ActionButtonConfig = {
  actionId: TransitionAction;
  label: string;
  pendingLabel: string;
  title: string;
  variant?: "default" | "outline" | "destructive";
};

const ACTION_CONFIG: Record<TransitionAction, ActionButtonConfig> = {
  submit: {
    actionId: "submit",
    label: "Отправить",
    pendingLabel: "Отправка...",
    title: "отправка",
    variant: "outline",
  },
  approve: {
    actionId: "approve",
    label: "Согласовать",
    pendingLabel: "Согласование...",
    title: "согласование",
    variant: "outline",
  },
  reject: {
    actionId: "reject",
    label: "Отклонить",
    pendingLabel: "Отклонение...",
    title: "отклонение",
    variant: "destructive",
  },
  post: {
    actionId: "post",
    label: "Провести",
    pendingLabel: "Проведение...",
    title: "проведение",
  },
  cancel: {
    actionId: "cancel",
    label: "Отменить",
    pendingLabel: "Отмена...",
    title: "отмена",
    variant: "destructive",
  },
  repost: {
    actionId: "repost",
    label: "Перепровести",
    pendingLabel: "Перепроведение...",
    title: "перепроведение",
    variant: "outline",
  },
};

export function DocumentActionButtons({
  docType,
  documentId,
  allowedActions,
  mutators,
  returnOnPostedHref,
  onPostedSuccess,
}: DocumentActionButtonsProps) {
  const router = useRouter();
  const [activeAction, setActiveAction] = useState<TransitionAction | null>(
    null,
  );

  const visibleActions = (
    [
      "submit",
      "approve",
      "reject",
      "post",
      "cancel",
      "repost",
    ] as TransitionAction[]
  ).filter((action) => allowedActions.includes(action) && mutators[action]);

  if (visibleActions.length === 0) {
    return null;
  }

  async function runAction(action: TransitionAction) {
    const mutator = mutators[action];
    if (!mutator) return;

    const config = ACTION_CONFIG[action];
    setActiveAction(action);

    const result = await mutator({ docType, documentId });

    if (!result.ok) {
      toast.error(
        result.message ?? `Не удалось выполнить действие ${config.title}`,
      );
      setActiveAction(null);
      return;
    }

    if (action === "post") {
      if (onPostedSuccess) {
        await onPostedSuccess();
      }

      if (returnOnPostedHref) {
        toast.success("Документ проведен — возвращаемся к сделке");
        setActiveAction(null);
        router.push(returnOnPostedHref);
        return;
      }
    }

    toast.success(`Документ: ${config.title}`);
    setActiveAction(null);
    router.refresh();
  }

  return (
    <div className="flex w-full flex-wrap justify-start gap-2 md:w-auto md:justify-end">
      {visibleActions.map((action) => {
        const config = ACTION_CONFIG[action];
        return (
          <Button
            key={action}
            data-testid={`document-action-${action}`}
            type="button"
            size="lg"
            variant={config.variant}
            disabled={activeAction !== null}
            onClick={() => void runAction(action)}
          >
            {activeAction === action ? config.pendingLabel : config.label}
          </Button>
        );
      })}
    </div>
  );
}
