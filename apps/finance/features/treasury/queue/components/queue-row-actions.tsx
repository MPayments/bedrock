"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";

import type { TreasuryExceptionQueueRow } from "@bedrock/deals/contracts";
import { Button } from "@bedrock/sdk-ui/components/button";

import type {
  QueueRowActions,
  QueueRowActionsState,
} from "../lib/use-queue-row-actions";

export interface TreasuryQueueRowActionsProps {
  actions: QueueRowActions;
  row: TreasuryExceptionQueueRow;
  state: QueueRowActionsState;
}

function buildDealHref(
  row: TreasuryExceptionQueueRow,
  opts: { tab?: "execution"; legIdx?: number | null } = {},
) {
  if (!row.dealId) return null;
  const params = new URLSearchParams();
  if (opts.tab) params.set("tab", opts.tab);
  if (opts.legIdx) params.set("leg", String(opts.legIdx));
  const query = params.toString();
  return query
    ? `/treasury/deals/${row.dealId}?${query}`
    : `/treasury/deals/${row.dealId}`;
}

export function TreasuryQueueRowActions({
  actions,
  row,
  state,
}: TreasuryQueueRowActionsProps) {
  switch (row.kind) {
    case "ready_leg": {
      const href = buildDealHref(row, {
        legIdx: row.legIdx,
        tab: "execution",
      });
      return (
        <Button
          disabled={!href}
          nativeButton={false}
          render={href ? <Link href={href} /> : undefined}
          size="sm"
          variant="outline"
        >
          Подготовить инструкцию
        </Button>
      );
    }

    case "blocked_leg": {
      const href = buildDealHref(row, {
        legIdx: row.legIdx,
        tab: "execution",
      });
      return (
        <Button
          disabled={!href}
          nativeButton={false}
          render={href ? <Link href={href} /> : undefined}
          size="sm"
          variant="outline"
        >
          Разобрать шаг
        </Button>
      );
    }

    case "failed_instruction": {
      if (!row.instructionId) return null;
      const instructionId = row.instructionId;
      const retrying = state.retryingInstructionId === instructionId;
      const voiding = state.voidingInstructionId === instructionId;
      return (
        <div className="flex gap-2">
          <Button
            disabled={retrying || voiding}
            onClick={() => void actions.retryInstruction(instructionId)}
            size="sm"
            variant="outline"
          >
            {retrying ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Повторить
          </Button>
          <Button
            disabled={retrying || voiding}
            onClick={() => void actions.voidInstruction(instructionId)}
            size="sm"
            variant="ghost"
          >
            {voiding ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Отменить
          </Button>
        </div>
      );
    }

    case "reconciliation_mismatch": {
      const exceptionId =
        typeof row.metadata?.exceptionId === "string"
          ? row.metadata.exceptionId
          : null;
      const href = buildDealHref(row, { tab: "execution" });
      if (!row.dealId || !exceptionId) {
        return href ? (
          <Button
            nativeButton={false}
            render={<Link href={href} />}
            size="sm"
            variant="outline"
          >
            Открыть сделку
          </Button>
        ) : null;
      }
      const dealId = row.dealId;
      const ignoring = state.ignoringExceptionId === exceptionId;
      return (
        <div className="flex gap-2">
          {href ? (
            <Button
              nativeButton={false}
              render={<Link href={href} />}
              size="sm"
              variant="outline"
            >
              Создать корректировку
            </Button>
          ) : null}
          <Button
            disabled={ignoring}
            onClick={() =>
              void actions.ignoreReconciliationException({
                dealId,
                exceptionId,
              })
            }
            size="sm"
            variant="ghost"
          >
            {ignoring ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Игнорировать
          </Button>
        </div>
      );
    }

    case "pre_funded_awaiting_collection":
    case "intercompany_imbalance": {
      const href = buildDealHref(row, { tab: "execution" });
      if (!href) return null;
      return (
        <Button
          nativeButton={false}
          render={<Link href={href} />}
          size="sm"
          variant="outline"
        >
          Открыть сделку
        </Button>
      );
    }

    default:
      return null;
  }
}
