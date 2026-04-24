import type { CurrenciesService } from "@bedrock/currencies";
import type { DealPricingContext } from "@bedrock/deals/contracts";
import type { QuoteDetailsRecord } from "@bedrock/treasury/contracts";

import type { FinanceDealRouteAttachment } from "../contracts";
import type { DealProjectionsWorkflowDeps } from "../shared/deps";

export async function buildFinanceRouteAttachment(input: {
  acceptedQuoteDetails: QuoteDetailsRecord | null;
  applicantCounterpartyId?: string | null;
  beneficiaryCounterpartyId?: string | null;
  currencies: Pick<CurrenciesService, "findById">;
  parties: DealProjectionsWorkflowDeps["parties"];
  pricingContext: DealPricingContext | null;
}): Promise<FinanceDealRouteAttachment | null> {
  const attachment = input.pricingContext?.routeAttachment;
  if (!attachment) {
    return null;
  }

  const legs = attachment.snapshot.legs;
  const currencyIds = Array.from(
    new Set(legs.flatMap((leg) => [leg.fromCurrencyId, leg.toCurrencyId])),
  );
  const codeByCurrencyId = new Map(
    await Promise.all(
      currencyIds.map(
        async (currencyId): Promise<readonly [string, string | null]> => {
          try {
            const currency = await input.currencies.findById(currencyId);
            return [currencyId, currency?.code ?? null] as const;
          } catch {
            return [currencyId, null] as const;
          }
        },
      ),
    ),
  );

  const quoteLegByIdx = new Map(
    (input.acceptedQuoteDetails?.legs ?? []).map(
      (leg) => [leg.idx, leg] as const,
    ),
  );

  const participantsWithEntity = attachment.snapshot.participants.filter(
    (participant) =>
      participant.binding === "bound" &&
      participant.entityId !== null &&
      participant.entityKind !== null,
  );
  const counterpartyIds = Array.from(
    new Set([
      ...participantsWithEntity
        .filter((participant) => participant.entityKind === "counterparty")
        .map((participant) => participant.entityId as string),
      ...(input.applicantCounterpartyId ? [input.applicantCounterpartyId] : []),
      ...(input.beneficiaryCounterpartyId
        ? [input.beneficiaryCounterpartyId]
        : []),
    ]),
  );
  const organizationIds = Array.from(
    new Set(
      participantsWithEntity
        .filter((participant) => participant.entityKind === "organization")
        .map((participant) => participant.entityId as string),
    ),
  );
  const counterpartyNameById = new Map(
    (
      await Promise.all(
        counterpartyIds.map(async (id) => {
          try {
            const counterparty =
              await input.parties.counterparties.queries.findById(id);
            return [
              id,
              counterparty?.shortName ?? counterparty?.fullName ?? null,
            ] as const;
          } catch {
            return [id, null] as const;
          }
        }),
      )
    ).filter((entry): entry is readonly [string, string] => entry[1] !== null),
  );
  const organizationNameById = new Map(
    (
      await Promise.all(
        organizationIds.map(async (id) => {
          try {
            const organization =
              await input.parties.organizations.queries.findById(id);
            return [
              id,
              organization?.shortName ?? organization?.fullName ?? null,
            ] as const;
          } catch {
            return [id, null] as const;
          }
        }),
      )
    ).filter((entry): entry is readonly [string, string] => entry[1] !== null),
  );

  type SnapshotParticipant = (typeof attachment.snapshot.participants)[number];

  function resolveAbstractDealEdge(
    participant: SnapshotParticipant,
  ): { entityId: string; displayName: string | null } | null {
    if (participant.binding !== "abstract") return null;
    if (participant.role === "source" && input.applicantCounterpartyId) {
      return {
        entityId: input.applicantCounterpartyId,
        displayName:
          counterpartyNameById.get(input.applicantCounterpartyId) ?? null,
      };
    }
    if (
      participant.role === "destination" &&
      input.beneficiaryCounterpartyId
    ) {
      return {
        entityId: input.beneficiaryCounterpartyId,
        displayName:
          counterpartyNameById.get(input.beneficiaryCounterpartyId) ?? null,
      };
    }
    return null;
  }

  function resolveParticipantDisplayName(
    participant: SnapshotParticipant,
  ): string {
    if (participant.binding !== "bound" || !participant.entityId) {
      const dealEdge = resolveAbstractDealEdge(participant);
      if (dealEdge?.displayName) return dealEdge.displayName;
      return participant.displayName;
    }
    if (participant.entityKind === "counterparty") {
      return (
        counterpartyNameById.get(participant.entityId) ??
        participant.displayName
      );
    }
    if (participant.entityKind === "organization") {
      return (
        organizationNameById.get(participant.entityId) ??
        participant.displayName
      );
    }
    return participant.displayName;
  }

  return {
    attachedAt: attachment.attachedAt.toISOString(),
    legs: legs.map((leg, index) => {
      const quoteLeg = quoteLegByIdx.get(index + 1) ?? null;
      return {
        fees: leg.fees.map((fee) => ({
          chargeToCustomer: fee.chargeToCustomer,
          kind: fee.kind,
          label: fee.label ?? fee.kind,
          percentage: fee.percentage ?? null,
        })),
        fromAmountMinor: quoteLeg?.fromAmountMinor.toString() ?? null,
        fromCurrencyCode: codeByCurrencyId.get(leg.fromCurrencyId) ?? null,
        fromCurrencyId: leg.fromCurrencyId,
        id: leg.id,
        rateDen: quoteLeg?.rateDen.toString() ?? null,
        rateNum: quoteLeg?.rateNum.toString() ?? null,
        toAmountMinor: quoteLeg?.toAmountMinor.toString() ?? null,
        toCurrencyCode: codeByCurrencyId.get(leg.toCurrencyId) ?? null,
        toCurrencyId: leg.toCurrencyId,
      };
    }),
    participants: attachment.snapshot.participants.map((participant) => {
      const dealEdge = resolveAbstractDealEdge(participant);
      const resolvedDisplayName = resolveParticipantDisplayName(participant);
      return {
        binding: participant.binding,
        displayName: resolvedDisplayName,
        entityId: dealEdge?.entityId ?? participant.entityId,
        entityKind: dealEdge
          ? "counterparty"
          : participant.entityKind,
        nodeId: participant.nodeId,
        requisiteId:
          "requisiteId" in participant
            ? (participant.requisiteId ?? null)
            : null,
        role: participant.role,
      };
    }),
    templateId: attachment.templateId,
    templateName: attachment.templateName,
  };
}
