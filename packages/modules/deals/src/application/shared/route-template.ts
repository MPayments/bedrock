import { NotFoundError, ValidationError } from "@bedrock/shared/core/errors";
import type { ModuleRuntime } from "@bedrock/shared/core";

import type {
  DealRouteCostComponentInput,
  DealRouteLegInput,
  DealRouteParticipantInput,
  DealRouteTemplateCostComponentInput,
  DealRouteTemplateLegInput,
  DealRouteTemplateParticipantInput,
} from "../contracts/commands";
import type {
  DealRouteTemplate,
  DealWorkflowProjection,
} from "../contracts/dto";
import type { DealsCommandTx } from "../ports/deals.uow";
import type { DealReferencesPort } from "../ports/references.port";

export interface DealRouteTemplateDefinitionInput {
  costComponents: DealRouteTemplateCostComponentInput[];
  dealType: DealWorkflowProjection["summary"]["type"];
  legs: DealRouteTemplateLegInput[];
  participants: DealRouteTemplateParticipantInput[];
}

function parseMinor(value: string | null): bigint | null {
  return value === null ? null : BigInt(value);
}

export async function validateDealRouteTemplateReferences(input: {
  references: DealReferencesPort;
  template: DealRouteTemplateDefinitionInput;
}) {
  const counterpartyIds = new Set<string>();
  const customerIds = new Set<string>();
  const organizationIds = new Set<string>();
  const currencyIds = new Set<string>();
  const requisiteIds = new Set<string>();

  for (const participant of input.template.participants) {
    if (participant.bindingKind === "fixed_party" && !participant.partyId) {
      throw new ValidationError(
        `Fixed participant ${participant.code} must include partyId`,
      );
    }

    if (participant.bindingKind === "fixed_party" && participant.partyId) {
      if (participant.partyKind === "customer") {
        customerIds.add(participant.partyId);
      } else if (participant.partyKind === "organization") {
        organizationIds.add(participant.partyId);
      } else {
        counterpartyIds.add(participant.partyId);
      }
    }

    if (participant.requisiteId) {
      requisiteIds.add(participant.requisiteId);
    }
  }

  for (const leg of input.template.legs) {
    currencyIds.add(leg.fromCurrencyId);
    currencyIds.add(leg.toCurrencyId);
    if (leg.executionCounterpartyId) {
      counterpartyIds.add(leg.executionCounterpartyId);
    }
  }

  for (const component of input.template.costComponents) {
    currencyIds.add(component.currencyId);
  }

  await Promise.all(
    [...customerIds].map(async (customerId) => {
      const customer = await input.references.findCustomerById(customerId);
      if (!customer) {
        throw new NotFoundError("Customer", customerId);
      }
    }),
  );

  await Promise.all(
    [...counterpartyIds].map(async (counterpartyId) => {
      const counterparty = await input.references.findCounterpartyById(
        counterpartyId,
      );
      if (!counterparty) {
        throw new NotFoundError("Counterparty", counterpartyId);
      }
    }),
  );

  await Promise.all(
    [...organizationIds].map(async (organizationId) => {
      const organization = await input.references.findOrganizationById(
        organizationId,
      );
      if (!organization) {
        throw new NotFoundError("Organization", organizationId);
      }
    }),
  );

  await Promise.all(
    [...currencyIds].map(async (currencyId) => {
      const currency = await input.references.findCurrencyById(currencyId);
      if (!currency) {
        throw new NotFoundError("Currency", currencyId);
      }
    }),
  );

  await Promise.all(
    [...requisiteIds].map(async (requisiteId) => {
      const requisite = await input.references.findRequisiteById(requisiteId);
      if (!requisite) {
        throw new NotFoundError("Requisite", requisiteId);
      }
    }),
  );
}

export function resolveRouteTemplateForDeal(input: {
  deal: DealWorkflowProjection;
  template: DealRouteTemplate;
}): {
  costComponents: DealRouteCostComponentInput[];
  legs: DealRouteLegInput[];
  participants: DealRouteParticipantInput[];
} {
  if (input.template.dealType !== input.deal.summary.type) {
    throw new ValidationError(
      `Template ${input.template.id} is for ${input.template.dealType}, deal requires ${input.deal.summary.type}`,
    );
  }

  const customerId =
    input.deal.participants.find((participant) => participant.role === "customer")
      ?.customerId ?? null;

  if (!customerId) {
    throw new ValidationError(
      `Deal ${input.deal.summary.id} is missing the customer participant required for route application`,
    );
  }

  const resolveParticipantPartyId = (
    participant: DealRouteTemplate["participants"][number],
  ) => {
    switch (participant.bindingKind) {
      case "fixed_party":
        return participant.partyId;
      case "deal_customer":
        return customerId;
      case "deal_applicant":
        return input.deal.header.common.applicantCounterpartyId;
      case "deal_payer":
        return input.deal.header.incomingReceipt.payerCounterpartyId;
      case "deal_beneficiary":
        return input.deal.header.externalBeneficiary.beneficiaryCounterpartyId;
    }
  };

  return {
    costComponents: input.template.costComponents.map((component) => ({
      basisType: component.basisType,
      bps: component.bps,
      classification: component.classification,
      code: component.code,
      currencyId: component.currencyId,
      family: component.family,
      fixedAmountMinor: component.fixedAmountMinor,
      formulaType: component.formulaType,
      includedInClientRate: component.includedInClientRate,
      legCode: component.legCode,
      manualAmountMinor: component.manualAmountMinor,
      notes: component.notes,
      perMillion: component.perMillion,
      roundingMode: component.roundingMode,
      sequence: component.sequence,
    })),
    legs: input.template.legs.map((leg) => ({
      code: leg.code,
      executionCounterpartyId: leg.executionCounterpartyId,
      expectedFromAmountMinor: leg.expectedFromAmountMinor,
      expectedRateDen: leg.expectedRateDen,
      expectedRateNum: leg.expectedRateNum,
      expectedToAmountMinor: leg.expectedToAmountMinor,
      fromCurrencyId: leg.fromCurrencyId,
      fromParticipantCode: leg.fromParticipantCode,
      idx: leg.idx,
      kind: leg.kind,
      notes: leg.notes,
      settlementModel: leg.settlementModel,
      toCurrencyId: leg.toCurrencyId,
      toParticipantCode: leg.toParticipantCode,
    })),
    participants: input.template.participants.map((participant) => {
      const partyId = resolveParticipantPartyId(participant);

      if (!partyId) {
        throw new ValidationError(
          `Template participant ${participant.code} could not be resolved from deal ${input.deal.summary.id}`,
        );
      }

      return {
        code: participant.code,
        displayNameSnapshot: participant.displayNameTemplate,
        metadata: participant.metadata,
        partyId,
        partyKind: participant.partyKind,
        requisiteId: participant.requisiteId,
        role: participant.role,
        sequence: participant.sequence,
      };
    }),
  };
}

export async function replaceRouteTemplateBody(input: {
  routeTemplateId: string;
  runtime: ModuleRuntime;
  template: DealRouteTemplateDefinitionInput;
  tx: DealsCommandTx;
}) {
  const participantIdByCode = new Map<string, string>();
  const legIdByCode = new Map<string, string>();

  await input.tx.dealStore.replaceDealRouteTemplateParticipants({
    participants: input.template.participants.map((participant) => {
      const participantId = input.runtime.generateUuid();
      participantIdByCode.set(participant.code, participantId);

      return {
        bindingKind: participant.bindingKind,
        code: participant.code,
        counterpartyId:
          participant.bindingKind === "fixed_party" &&
          participant.partyKind === "counterparty"
            ? participant.partyId
            : null,
        customerId:
          participant.bindingKind === "fixed_party" &&
          participant.partyKind === "customer"
            ? participant.partyId
            : null,
        displayNameTemplate: participant.displayNameTemplate,
        id: participantId,
        metadata: participant.metadata,
        organizationId:
          participant.bindingKind === "fixed_party" &&
          participant.partyKind === "organization"
            ? participant.partyId
            : null,
        partyKind: participant.partyKind,
        requisiteId: participant.requisiteId,
        role: participant.role,
        routeTemplateId: input.routeTemplateId,
        sequence: participant.sequence,
      };
    }),
    routeTemplateId: input.routeTemplateId,
  });

  await input.tx.dealStore.replaceDealRouteTemplateLegs({
    legs: input.template.legs.map((leg) => {
      const legId = input.runtime.generateUuid();
      legIdByCode.set(leg.code, legId);

      return {
        code: leg.code,
        executionCounterpartyId: leg.executionCounterpartyId,
        expectedFromAmountMinor: parseMinor(leg.expectedFromAmountMinor),
        expectedRateDen: parseMinor(leg.expectedRateDen),
        expectedRateNum: parseMinor(leg.expectedRateNum),
        expectedToAmountMinor: parseMinor(leg.expectedToAmountMinor),
        fromCurrencyId: leg.fromCurrencyId,
        fromParticipantId:
          participantIdByCode.get(leg.fromParticipantCode) ??
          (() => {
            throw new NotFoundError(
              "Route template participant",
              leg.fromParticipantCode,
            );
          })(),
        id: legId,
        idx: leg.idx,
        kind: leg.kind,
        notes: leg.notes,
        routeTemplateId: input.routeTemplateId,
        settlementModel: leg.settlementModel,
        toCurrencyId: leg.toCurrencyId,
        toParticipantId:
          participantIdByCode.get(leg.toParticipantCode) ??
          (() => {
            throw new NotFoundError(
              "Route template participant",
              leg.toParticipantCode,
            );
          })(),
      };
    }),
    routeTemplateId: input.routeTemplateId,
  });

  await input.tx.dealStore.replaceDealRouteTemplateCostComponents({
    costComponents: input.template.costComponents.map((component) => ({
      basisType: component.basisType,
      bps: component.bps,
      classification: component.classification,
      code: component.code,
      currencyId: component.currencyId,
      family: component.family,
      fixedAmountMinor: parseMinor(component.fixedAmountMinor),
      formulaType: component.formulaType,
      id: input.runtime.generateUuid(),
      includedInClientRate: component.includedInClientRate,
      legId: component.legCode ? (legIdByCode.get(component.legCode) ?? null) : null,
      manualAmountMinor: parseMinor(component.manualAmountMinor),
      notes: component.notes,
      perMillion: component.perMillion,
      roundingMode: component.roundingMode,
      routeTemplateId: input.routeTemplateId,
      sequence: component.sequence,
    })),
    routeTemplateId: input.routeTemplateId,
  });
}
