import { NotFoundError } from "@bedrock/shared/core/errors";
import type { ModuleRuntime } from "@bedrock/shared/core";

import { DealNotFoundError } from "../../errors";
import type {
  DealRouteCostComponentInput,
  DealRouteLegInput,
  DealRouteParticipantInput,
} from "../contracts/commands";
import type {
  DealRouteValidationIssue,
  DealRouteVersion,
} from "../contracts/dto";
import type { DealsCommandTx } from "../ports/deals.uow";
import type { DealReferencesPort } from "../ports/references.port";

export interface DealRouteDefinitionInput {
  costComponents: DealRouteCostComponentInput[];
  legs: DealRouteLegInput[];
  participants: DealRouteParticipantInput[];
}

function parseMinor(value: string | null): bigint | null {
  return value === null ? null : BigInt(value);
}

export async function validateDealRouteReferences(input: {
  dealCustomerId: string;
  references: DealReferencesPort;
  route: DealRouteDefinitionInput;
}) {
  const customerPartyIds = input.route.participants
    .filter((participant) => participant.partyKind === "customer")
    .map((participant) => participant.partyId);
  const counterpartyIds = new Set<string>();
  const organizationIds = new Set<string>();
  const currencyIds = new Set<string>();
  const requisiteIds = new Set<string>();

  for (const participant of input.route.participants) {
    if (participant.partyKind === "counterparty") {
      counterpartyIds.add(participant.partyId);
    }

    if (participant.partyKind === "organization") {
      organizationIds.add(participant.partyId);
    }

    if (participant.requisiteId) {
      requisiteIds.add(participant.requisiteId);
    }
  }

  for (const leg of input.route.legs) {
    currencyIds.add(leg.fromCurrencyId);
    currencyIds.add(leg.toCurrencyId);
    if (leg.executionCounterpartyId) {
      counterpartyIds.add(leg.executionCounterpartyId);
    }
  }

  for (const component of input.route.costComponents) {
    currencyIds.add(component.currencyId);
  }

  for (const customerId of customerPartyIds) {
    const customer = await input.references.findCustomerById(customerId);
    if (!customer) {
      throw new NotFoundError("Customer", customerId);
    }
    if (customerId !== input.dealCustomerId) {
      throw new NotFoundError("Deal customer", customerId);
    }
  }

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

export async function writeDealRouteVersion(input: {
  dealId: string;
  route: DealRouteDefinitionInput;
  runtime: ModuleRuntime;
  tx: DealsCommandTx;
  validationIssues: DealRouteValidationIssue[];
}): Promise<DealRouteVersion> {
  const currentRoute = await input.tx.dealReads.findCurrentRouteByDealId(
    input.dealId,
  );
  const routeId = currentRoute?.routeId ?? input.runtime.generateUuid();
  const versionId = input.runtime.generateUuid();
  const version = (currentRoute?.version ?? 0) + 1;

  if (!currentRoute) {
    await input.tx.dealStore.createDealRoute({
      dealId: input.dealId,
      id: routeId,
    });
  }

  await input.tx.dealStore.createDealRouteVersion({
    dealId: input.dealId,
    id: versionId,
    routeId,
    validationIssues: input.validationIssues,
    version,
  });

  const participantIdByCode = new Map<string, string>();
  const legIdByCode = new Map<string, string>();

  await input.tx.dealStore.createDealRouteParticipants(
    input.route.participants.map((participant) => {
      const participantId = input.runtime.generateUuid();
      participantIdByCode.set(participant.code, participantId);

      return {
        code: participant.code,
        counterpartyId:
          participant.partyKind === "counterparty" ? participant.partyId : null,
        customerId:
          participant.partyKind === "customer" ? participant.partyId : null,
        displayNameSnapshot: participant.displayNameSnapshot,
        id: participantId,
        metadata: participant.metadata,
        organizationId:
          participant.partyKind === "organization" ? participant.partyId : null,
        partyKind: participant.partyKind,
        requisiteId: participant.requisiteId,
        role: participant.role,
        routeVersionId: versionId,
        sequence: participant.sequence,
      };
    }),
  );

  await input.tx.dealStore.createDealRouteLegs(
    input.route.legs.map((leg) => {
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
            throw new NotFoundError("Route participant", leg.fromParticipantCode);
          })(),
        id: legId,
        idx: leg.idx,
        kind: leg.kind,
        notes: leg.notes,
        routeVersionId: versionId,
        settlementModel: leg.settlementModel,
        toCurrencyId: leg.toCurrencyId,
        toParticipantId:
          participantIdByCode.get(leg.toParticipantCode) ??
          (() => {
            throw new NotFoundError("Route participant", leg.toParticipantCode);
          })(),
      };
    }),
  );

  await input.tx.dealStore.createDealRouteCostComponents(
    input.route.costComponents.map((component) => ({
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
      routeVersionId: versionId,
      sequence: component.sequence,
    })),
  );

  await input.tx.dealStore.setDealRouteCurrentVersion({
    currentVersionId: versionId,
    dealId: input.dealId,
  });

  const route = await input.tx.dealReads.findCurrentRouteByDealId(input.dealId);
  if (!route) {
    throw new DealNotFoundError(input.dealId);
  }

  return route;
}
