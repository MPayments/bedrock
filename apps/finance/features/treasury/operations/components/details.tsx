"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, Workflow } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import { formatCompactId } from "@bedrock/shared/core/uuid";

import { EntityWorkspaceLayout } from "@/components/entities/workspace-layout";
import { StepAttemptsDrawer } from "@/features/treasury/steps/components/step-attempts-drawer";
import { StepCard } from "@/features/treasury/steps/components/step-card";
import { STEP_KIND_LABELS } from "@/features/treasury/steps/lib/step-helpers";

import type { TreasuryOperationDetails } from "../lib/queries";

type TreasuryOperationDetailsProps = {
  operation: TreasuryOperationDetails;
};

const PURPOSE_SUBTITLES: Record<
  TreasuryOperationDetails["purpose"],
  string
> = {
  deal_leg: "Платёжный шаг в рамках клиентской сделки.",
  pre_fund: "Пре-фондирование под будущие сделки.",
  standalone_payment:
    "Отдельная казначейская операция без привязки к сделке.",
};

export function TreasuryOperationDetailsView({
  operation,
}: TreasuryOperationDetailsProps) {
  const router = useRouter();
  const [attemptsOpen, setAttemptsOpen] = useState(false);

  const title = `Операция #${formatCompactId(operation.id)}`;
  const hasDealContext = operation.purpose === "deal_leg" && operation.dealId;
  const dealHref = hasDealContext
    ? `/treasury/deals/${encodeURIComponent(operation.dealId!)}`
    : null;
  const uploadAssetPath = `/v1/treasury/steps/${encodeURIComponent(operation.id)}/attachments`;

  return (
    <EntityWorkspaceLayout
      icon={Workflow}
      title={title}
      subtitle={PURPOSE_SUBTITLES[operation.purpose]}
      controls={
        <div className="flex flex-wrap items-center gap-2">
          {dealHref ? (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={dealHref} />}
            >
              <ArrowUpRight className="mr-1 size-3" />
              Перейти к сделке
            </Button>
          ) : null}
          {operation.attempts.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAttemptsOpen(true)}
            >
              История попыток ({operation.attempts.length})
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="max-w-3xl">
        <StepCard
          step={operation}
          title={
            hasDealContext && operation.origin.sequence !== null
              ? `Шаг ${operation.origin.sequence} · ${STEP_KIND_LABELS[operation.kind]}`
              : STEP_KIND_LABELS[operation.kind]
          }
          uploadAssetPath={uploadAssetPath}
          onChanged={() => router.refresh()}
        />
      </div>

      <StepAttemptsDrawer
        step={operation}
        open={attemptsOpen}
        onOpenChange={setAttemptsOpen}
      />
    </EntityWorkspaceLayout>
  );
}
