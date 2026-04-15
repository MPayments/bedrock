import type { DealRouteValidationIssue } from "../application/contracts/dto";
import type {
  DealRouteTemplateCostComponentInput,
  DealRouteTemplateLegInput,
  DealRouteTemplateParticipantInput,
} from "../application/contracts/commands";
import type { DealType } from "../application/contracts/zod";

interface ValidateDealRouteTemplateInput {
  costComponents: DealRouteTemplateCostComponentInput[];
  dealType: DealType;
  legs: DealRouteTemplateLegInput[];
  participants: DealRouteTemplateParticipantInput[];
}

function pushIssue(
  issues: DealRouteValidationIssue[],
  input: Omit<DealRouteValidationIssue, "severity"> & {
    severity?: DealRouteValidationIssue["severity"];
  },
) {
  issues.push({
    severity: input.severity ?? "error",
    ...input,
  });
}

export function validateDealRouteTemplateDefinition(
  input: ValidateDealRouteTemplateInput,
): DealRouteValidationIssue[] {
  const issues: DealRouteValidationIssue[] = [];
  const participantCodes = new Map<string, DealRouteTemplateParticipantInput>();
  const legCodes = new Map<string, DealRouteTemplateLegInput>();

  for (const participant of input.participants) {
    if (participantCodes.has(participant.code)) {
      pushIssue(issues, {
        code: "template.participant.code_duplicate",
        message: `Participant code ${participant.code} must be unique`,
        path: `participants.${participant.code}`,
      });
      continue;
    }

    if (participant.bindingKind === "fixed_party" && !participant.partyId) {
      pushIssue(issues, {
        code: "template.participant.fixed_party_missing",
        message: `Fixed participant ${participant.code} requires partyId`,
        path: `participants.${participant.code}.partyId`,
      });
    }

    if (participant.bindingKind !== "fixed_party" && participant.partyId) {
      pushIssue(issues, {
        code: "template.participant.dynamic_party_forbidden",
        message: `Dynamic participant ${participant.code} must not set partyId`,
        path: `participants.${participant.code}.partyId`,
      });
    }

    if (
      participant.bindingKind === "deal_customer" &&
      participant.partyKind !== "customer"
    ) {
      pushIssue(issues, {
        code: "template.participant.customer_binding_kind_mismatch",
        message: `Participant ${participant.code} must use partyKind=customer for deal_customer binding`,
        path: `participants.${participant.code}.partyKind`,
      });
    }

    if (
      participant.bindingKind !== "fixed_party" &&
      participant.bindingKind !== "deal_customer" &&
      participant.partyKind !== "counterparty"
    ) {
      pushIssue(issues, {
        code: "template.participant.counterparty_binding_kind_mismatch",
        message: `Participant ${participant.code} must use partyKind=counterparty for deal-bound external bindings`,
        path: `participants.${participant.code}.partyKind`,
      });
    }

    participantCodes.set(participant.code, participant);
  }

  for (const [index, participant] of input.participants.entries()) {
    if (participant.sequence !== index + 1) {
      pushIssue(issues, {
        code: "template.participant.sequence_not_contiguous",
        message: "Participant sequence must be contiguous and start at 1",
        path: `participants.${participant.code}.sequence`,
      });
    }
  }

  for (const leg of input.legs) {
    if (legCodes.has(leg.code)) {
      pushIssue(issues, {
        code: "template.leg.code_duplicate",
        message: `Leg code ${leg.code} must be unique`,
        path: `legs.${leg.code}`,
      });
      continue;
    }

    legCodes.set(leg.code, leg);
  }

  for (const [index, leg] of input.legs.entries()) {
    if (leg.idx !== index + 1) {
      pushIssue(issues, {
        code: "template.leg.idx_not_contiguous",
        message: "Leg idx must be contiguous and start at 1",
        path: `legs.${leg.code}.idx`,
      });
    }

    if (!participantCodes.has(leg.fromParticipantCode)) {
      pushIssue(issues, {
        code: "template.leg.from_participant_missing",
        message: `Leg ${leg.code} references missing participant ${leg.fromParticipantCode}`,
        path: `legs.${leg.code}.fromParticipantCode`,
      });
    }

    if (!participantCodes.has(leg.toParticipantCode)) {
      pushIssue(issues, {
        code: "template.leg.to_participant_missing",
        message: `Leg ${leg.code} references missing participant ${leg.toParticipantCode}`,
        path: `legs.${leg.code}.toParticipantCode`,
      });
    }

    const sameCurrency = leg.fromCurrencyId === leg.toCurrencyId;
    if (leg.kind === "fx_conversion" && sameCurrency) {
      pushIssue(issues, {
        code: "template.leg.fx_same_currency",
        message: `FX leg ${leg.code} must change currency`,
        path: `legs.${leg.code}.toCurrencyId`,
      });
    }

    if (
      leg.kind !== "fx_conversion" &&
      leg.kind !== "adjustment" &&
      !sameCurrency
    ) {
      pushIssue(issues, {
        code: "template.leg.non_fx_currency_mismatch",
        message: `Leg ${leg.code} must keep the same currency unless it is FX or adjustment`,
        path: `legs.${leg.code}.toCurrencyId`,
      });
    }
  }

  if (input.legs.length > 0 && input.participants.length > 0) {
    const adjacency = new Map<string, Set<string>>();
    for (const participant of input.participants) {
      adjacency.set(participant.code, new Set());
    }

    for (const leg of input.legs) {
      adjacency.get(leg.fromParticipantCode)?.add(leg.toParticipantCode);
      adjacency.get(leg.toParticipantCode)?.add(leg.fromParticipantCode);
    }

    const start = input.participants[0]?.code;
    const visited = new Set<string>();
    const queue = start ? [start] : [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) {
        continue;
      }

      visited.add(current);
      for (const next of adjacency.get(current) ?? []) {
        if (!visited.has(next)) {
          queue.push(next);
        }
      }
    }

    if (visited.size !== input.participants.length) {
      pushIssue(issues, {
        code: "template.route.graph_disconnected",
        message: "Route template participant graph must be connected",
        path: null,
      });
    }
  }

  for (const component of input.costComponents) {
    if (component.legCode && !legCodes.has(component.legCode)) {
      pushIssue(issues, {
        code: "template.component.leg_missing",
        message: `Cost component ${component.code} references missing leg ${component.legCode}`,
        path: `costComponents.${component.code}.legCode`,
      });
    }

    if (
      (component.basisType === "leg_from_amount" ||
        component.basisType === "leg_to_amount") &&
      !component.legCode
    ) {
      pushIssue(issues, {
        code: "template.component.leg_required",
        message: `Cost component ${component.code} requires a leg binding for basis ${component.basisType}`,
        path: `costComponents.${component.code}.basisType`,
      });
    }

    if (component.formulaType === "fixed" && !component.fixedAmountMinor) {
      pushIssue(issues, {
        code: "template.component.fixed_amount_missing",
        message: `Fixed component ${component.code} requires fixedAmountMinor`,
        path: `costComponents.${component.code}.fixedAmountMinor`,
      });
    }

    if (component.formulaType === "bps" && !component.bps) {
      pushIssue(issues, {
        code: "template.component.bps_missing",
        message: `BPS component ${component.code} requires bps`,
        path: `costComponents.${component.code}.bps`,
      });
    }

    if (component.formulaType === "per_million" && !component.perMillion) {
      pushIssue(issues, {
        code: "template.component.per_million_missing",
        message: `Per-million component ${component.code} requires perMillion`,
        path: `costComponents.${component.code}.perMillion`,
      });
    }

    if (component.formulaType === "manual" && !component.manualAmountMinor) {
      pushIssue(issues, {
        code: "template.component.manual_amount_missing",
        message: `Manual component ${component.code} requires manualAmountMinor`,
        path: `costComponents.${component.code}.manualAmountMinor`,
      });
    }
  }

  const hasCustomer = input.participants.some(
    (participant) => participant.partyKind === "customer",
  );
  if (!hasCustomer) {
    pushIssue(issues, {
      code: "template.route.customer_missing",
      message: "Route template must include a customer participant",
      path: null,
    });
  }

  const hasPayout = input.legs.some((leg) => leg.kind === "payout");
  const hasCollection = input.legs.some((leg) => leg.kind === "collection");
  const hasFx = input.legs.some((leg) => leg.kind === "fx_conversion");

  if (input.dealType === "payment" && !hasPayout) {
    pushIssue(issues, {
      code: "template.route.payment_payout_missing",
      message: "Payment templates must include a payout leg",
      path: null,
    });
  }

  if (input.dealType === "currency_exchange" && !hasFx) {
    pushIssue(issues, {
      code: "template.route.fx_leg_missing",
      message: "Currency exchange templates must include an FX conversion leg",
      path: null,
    });
  }

  if (
    (input.dealType === "currency_transit" ||
      input.dealType === "exporter_settlement") &&
    (!hasCollection || !hasPayout)
  ) {
    pushIssue(issues, {
      code: "template.route.transit_flow_incomplete",
      message: "Transit-like templates must include both collection and payout legs",
      path: null,
    });
  }

  return issues;
}
