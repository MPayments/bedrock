"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { toast } from "@bedrock/sdk-ui/components/sonner";

import { executeMutation } from "@/lib/resources/http";

export interface QueueRowActions {
  ignoreReconciliationException: (input: {
    dealId: string;
    exceptionId: string;
  }) => Promise<void>;
}

export interface QueueRowActionsState {
  ignoringExceptionId: string | null;
}

export function useQueueRowActions(): {
  actions: QueueRowActions;
  state: QueueRowActionsState;
} {
  const router = useRouter();
  const [ignoringExceptionId, setIgnoringExceptionId] = useState<string | null>(
    null,
  );

  async function ignoreReconciliationException(input: {
    dealId: string;
    exceptionId: string;
  }) {
    setIgnoringExceptionId(input.exceptionId);
    const result = await executeMutation({
      fallbackMessage: "Не удалось игнорировать исключение сверки",
      request: () =>
        fetch(
          `/v1/deals/${encodeURIComponent(input.dealId)}/reconciliation/exceptions/${encodeURIComponent(input.exceptionId)}/ignore`,
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

    toast.success("Исключение помечено как игнорируемое");
    router.refresh();
  }

  return {
    actions: {
      ignoreReconciliationException,
    },
    state: {
      ignoringExceptionId,
    },
  };
}
