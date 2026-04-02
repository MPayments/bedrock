"use client";

import type { ComponentProps } from "react";
import { useEffect, useState } from "react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bedrock/sdk-ui/components/dialog";

import type { FinanceDealWorkspace } from "@/features/treasury/deals/lib/queries";

import { FinanceDealWorkspaceView } from "./workspace-view";

type DealWorkflowDialogProps = {
  dealId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
  triggerLabel?: string;
  triggerSize?: ComponentProps<typeof Button>["size"];
  triggerVariant?: ComponentProps<typeof Button>["variant"];
};

function formatRequestError(status: number) {
  return `Не удалось загрузить рабочий стол сделки (${status})`;
}

export function DealWorkflowDialog({
  dealId,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
  triggerLabel = "Просмотр",
  triggerSize = "sm",
  triggerVariant = "outline",
}: DealWorkflowDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [data, setData] = useState<FinanceDealWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const open = controlledOpen ?? internalOpen;

  useEffect(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, [dealId]);

  async function loadWorkflow() {
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/v1/deals/${encodeURIComponent(dealId)}/finance-workspace`,
        {
          cache: "no-store",
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error(formatRequestError(response.status));
      }

      setData((await response.json()) as FinanceDealWorkspace);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Не удалось загрузить рабочий стол сделки",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (controlledOpen === undefined) {
      setInternalOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);

    if (nextOpen && !data && !isLoading) {
      void loadWorkflow();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {showTrigger ? (
        <DialogTrigger
          render={<Button size={triggerSize} variant={triggerVariant} />}
        >
          {triggerLabel}
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Рабочий стол сделки</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Загрузка…</div>
        ) : null}
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        {data ? <FinanceDealWorkspaceView deal={data} /> : null}
      </DialogContent>
    </Dialog>
  );
}
