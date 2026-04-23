"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { toast } from "@bedrock/sdk-ui/components/sonner";

import { executeMutation } from "@/lib/resources/http";

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export interface QueueRowActions {
  ignoreReconciliationException: (input: {
    dealId: string;
    exceptionId: string;
  }) => Promise<void>;
  retryInstruction: (instructionId: string) => Promise<void>;
  voidInstruction: (instructionId: string) => Promise<void>;
}

export interface QueueRowActionsState {
  ignoringExceptionId: string | null;
  retryingInstructionId: string | null;
  voidingInstructionId: string | null;
}

export function useQueueRowActions(): {
  actions: QueueRowActions;
  state: QueueRowActionsState;
} {
  const router = useRouter();
  const [retryingInstructionId, setRetryingInstructionId] = useState<
    string | null
  >(null);
  const [voidingInstructionId, setVoidingInstructionId] = useState<
    string | null
  >(null);
  const [ignoringExceptionId, setIgnoringExceptionId] = useState<string | null>(
    null,
  );

  async function retryInstruction(instructionId: string) {
    setRetryingInstructionId(instructionId);
    const result = await executeMutation({
      fallbackMessage: "Не удалось повторить инструкцию",
      request: () =>
        fetch(
          `/v1/treasury/instructions/${encodeURIComponent(instructionId)}/retry`,
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
    setRetryingInstructionId(null);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Инструкция повторена");
    router.refresh();
  }

  async function voidInstruction(instructionId: string) {
    setVoidingInstructionId(instructionId);
    const result = await executeMutation({
      fallbackMessage: "Не удалось отменить инструкцию",
      request: () =>
        fetch(
          `/v1/treasury/instructions/${encodeURIComponent(instructionId)}/void`,
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
    setVoidingInstructionId(null);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Инструкция отменена");
    router.refresh();
  }

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
      retryInstruction,
      voidInstruction,
    },
    state: {
      ignoringExceptionId,
      retryingInstructionId,
      voidingInstructionId,
    },
  };
}
