"use client";

import { ArrowRight } from "lucide-react";

import type {
  FinanceDealRouteAttachment,
  FinanceDealRouteAttachmentParticipant,
  FinanceDealWorkbench,
} from "@/features/treasury/deals/lib/queries";

type Leg = FinanceDealWorkbench["executionPlan"][number];
type Participant = NonNullable<
  FinanceDealWorkbench["workflow"]
>["participants"][number];

interface ResolvedParticipant {
  displayName: string;
  role: string;
}

const DEAL_PARTICIPANT_ROLE_LABEL: Record<string, string> = {
  applicant: "Заявитель",
  customer: "Клиент",
  external_beneficiary: "Бенефициар",
  external_payer: "Внешний плательщик",
  internal_entity: "Внутренний контрагент",
};

const ROUTE_PARTICIPANT_ROLE_LABEL: Record<
  FinanceDealRouteAttachmentParticipant["role"],
  string
> = {
  source: "Отправитель",
  hop: "Промежуточный узел",
  destination: "Получатель",
};

function toResolvedParticipant(
  participant: FinanceDealRouteAttachmentParticipant,
): ResolvedParticipant {
  return {
    displayName: participant.displayName,
    role: ROUTE_PARTICIPANT_ROLE_LABEL[participant.role],
  };
}

function findDealParticipant(
  participants: Participant[],
  role: Participant["role"],
): ResolvedParticipant | null {
  const found = participants.find((candidate) => candidate.role === role);
  if (!found) return null;
  const displayName =
    found.displayName && found.displayName.trim().length > 0
      ? found.displayName
      : "—";
  return {
    displayName,
    role: DEAL_PARTICIPANT_ROLE_LABEL[role] ?? role,
  };
}

function resolveHopPosition(
  leg: Leg,
  routeAttachment: FinanceDealRouteAttachment,
): number | null {
  if (!leg.routeSnapshotLegId) return null;
  const idx = routeAttachment.legs.findIndex(
    (routeLeg) => routeLeg.id === leg.routeSnapshotLegId,
  );
  return idx >= 0 ? idx : null;
}

function resolveParticipantsForLeg(
  leg: Leg,
  deal: FinanceDealWorkbench,
): { from: ResolvedParticipant | null; to: ResolvedParticipant | null } {
  const routeAttachment = deal.pricing.routeAttachment;
  const dealParticipants = deal.workflow?.participants ?? [];

  if (routeAttachment && leg.routeSnapshotLegId) {
    const hopPosition = resolveHopPosition(leg, routeAttachment);
    if (hopPosition !== null) {
      const from = routeAttachment.participants[hopPosition] ?? null;
      const to = routeAttachment.participants[hopPosition + 1] ?? null;
      return {
        from: from ? toResolvedParticipant(from) : null,
        to: to ? toResolvedParticipant(to) : null,
      };
    }
  }

  if (leg.kind === "collect") {
    return {
      from:
        findDealParticipant(dealParticipants, "external_payer") ??
        findDealParticipant(dealParticipants, "applicant"),
      to: findDealParticipant(dealParticipants, "internal_entity"),
    };
  }
  if (leg.kind === "payout" || leg.kind === "settle_exporter") {
    return {
      from: findDealParticipant(dealParticipants, "internal_entity"),
      to: findDealParticipant(dealParticipants, "external_beneficiary"),
    };
  }
  return { from: null, to: null };
}

export interface LegStepParticipantsProps {
  deal: FinanceDealWorkbench;
  leg: Leg;
}

export function LegStepParticipants({ deal, leg }: LegStepParticipantsProps) {
  const { from, to } = resolveParticipantsForLeg(leg, deal);

  if (!from && !to) {
    return null;
  }

  return (
    <div
      className="border-muted bg-muted/20 rounded-md border px-4 py-3"
      data-testid={`finance-deal-leg-step-participants-${leg.idx}`}
    >
      <div className="text-muted-foreground mb-2 text-xs uppercase tracking-wider">
        Участники шага
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <ParticipantPill participant={from} />
        <ArrowRight className="text-muted-foreground h-4 w-4" />
        <ParticipantPill participant={to} />
      </div>
    </div>
  );
}

function ParticipantPill({
  participant,
}: {
  participant: ResolvedParticipant | null;
}) {
  if (!participant) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1.5 rounded-md border border-dashed px-2 py-1 text-xs">
        Не назначен
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col gap-0.5 rounded-md border px-2.5 py-1.5">
      <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
        {participant.role}
      </span>
      <span className="text-sm font-medium">{participant.displayName}</span>
    </span>
  );
}
