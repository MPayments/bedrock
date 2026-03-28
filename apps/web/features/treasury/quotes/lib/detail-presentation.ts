import { FxExecutePayloadSchema } from "@bedrock/plugin-documents-ifrs/validation";

import {
  getApprovalStatusLabel,
  getLifecycleStatusLabel,
  getPostingStatusLabel,
  getSubmissionStatusLabel,
} from "@/features/documents/lib/status-labels";
import type { DocumentDetailsDto } from "@/features/operations/documents/lib/schemas";
import { formatDate } from "@/lib/format";

import { resolveUsedFxDocumentArtifact } from "./presentation";

function getDocumentStatusBadgeVariant(
  status: string,
  kind: "submission" | "approval" | "posting" | "lifecycle",
): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" {
  if (status === "approved" || status === "posted" || status === "active") {
    return "success";
  }

  if (kind === "approval" && status === "pending") {
    return "warning";
  }

  if (status === "submitted" || status === "posting") {
    return "default";
  }

  if (status === "draft" || status === "not_required" || status === "unposted") {
    return "secondary";
  }

  if (status === "rejected" || status === "failed" || status === "cancelled") {
    return "destructive";
  }

  return "outline";
}

function getOwnershipModeLabel(mode: string) {
  return mode === "cross_org" ? "Между организациями" : "Внутри организации";
}

function formatRouteEndpoint(input: {
  organizationId: string;
  organizationLabels: Record<string, string>;
  requisiteId: string;
  requisiteLabel?: string | null;
}) {
  const organizationLabel =
    input.organizationLabels[input.organizationId] ?? input.organizationId;
  const requisiteLabel = input.requisiteLabel ?? input.requisiteId;

  return `${organizationLabel} · ${requisiteLabel}`;
}

export type LinkedFxDocumentArtifactView = {
  docNo: string;
  href: string;
  title: string;
  statusBadges: Array<{
    label: string;
    value: string;
    variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
  }>;
  summary: Array<{
    label: string;
    value: string;
    tone?: "default" | "mono";
  }>;
  postingOperationId: string | null;
};

export function presentLinkedFxDocumentArtifact(input: {
  details: DocumentDetailsDto | null;
  organizationLabels: Record<string, string>;
  sourceRequisiteLabel?: string | null;
  destinationRequisiteLabel?: string | null;
}): LinkedFxDocumentArtifactView | null {
  if (!input.details) {
    return null;
  }

  const artifact = resolveUsedFxDocumentArtifact(
    `fx_execute:${input.details.document.id}`,
  );
  if (!artifact) {
    return null;
  }

  const payload = FxExecutePayloadSchema.safeParse(input.details.document.payload);

  const summary = [
    {
      label: "Документ",
      value: input.details.document.title,
    },
    {
      label: "Дата FX",
      value: formatDate(input.details.document.occurredAt),
    },
    {
      label: "Комментарий",
      value: input.details.document.memo ?? "—",
    },
  ] as LinkedFxDocumentArtifactView["summary"];

  if (payload.success) {
    summary.push(
      {
        label: "Execution ref",
        value: payload.data.executionRef ?? "—",
        tone: "mono",
      },
      {
        label: "Ownership mode",
        value: getOwnershipModeLabel(payload.data.ownershipMode),
      },
      {
        label: "Источник",
        value: formatRouteEndpoint({
          organizationId: payload.data.sourceOrganizationId,
          organizationLabels: input.organizationLabels,
          requisiteId: payload.data.sourceRequisiteId,
          requisiteLabel: input.sourceRequisiteLabel,
        }),
      },
      {
        label: "Назначение",
        value: formatRouteEndpoint({
          organizationId: payload.data.destinationOrganizationId,
          organizationLabels: input.organizationLabels,
          requisiteId: payload.data.destinationRequisiteId,
          requisiteLabel: input.destinationRequisiteLabel,
        }),
      },
    );

    if (payload.data.timeoutSeconds) {
      summary.push({
        label: "Таймаут",
        value: `${payload.data.timeoutSeconds} c`,
      });
    }
  }

  return {
    docNo: input.details.document.docNo,
    href: artifact.href,
    title: input.details.document.title,
    postingOperationId: input.details.document.postingOperationId,
    statusBadges: [
      {
        label: "Статус",
        value: getSubmissionStatusLabel(input.details.document.submissionStatus),
        variant: getDocumentStatusBadgeVariant(
          input.details.document.submissionStatus,
          "submission",
        ),
      },
      {
        label: "Согласование",
        value: getApprovalStatusLabel(input.details.document.approvalStatus),
        variant: getDocumentStatusBadgeVariant(
          input.details.document.approvalStatus,
          "approval",
        ),
      },
      {
        label: "Учет",
        value: getPostingStatusLabel(input.details.document.postingStatus),
        variant: getDocumentStatusBadgeVariant(
          input.details.document.postingStatus,
          "posting",
        ),
      },
      {
        label: "Жизненный цикл",
        value: getLifecycleStatusLabel(input.details.document.lifecycleStatus),
        variant: getDocumentStatusBadgeVariant(
          input.details.document.lifecycleStatus,
          "lifecycle",
        ),
      },
    ],
    summary,
  };
}
