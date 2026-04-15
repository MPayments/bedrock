import { describe, expect, it } from "vitest";

import type {
  DealRouteTemplate,
  DealWorkflowProjection,
} from "../../src/application/contracts/dto";
import { resolveRouteTemplateForDeal } from "../../src/application/shared/route-template";

function createDeal(): DealWorkflowProjection {
  return {
    acceptedCalculation: null,
    approvals: [],
    attachmentIngestions: [],
    executionPlan: [],
    header: {
      common: {
        applicantCounterpartyId: "00000000-0000-4000-8000-000000000311",
        customerNote: null,
        requestedExecutionDate: new Date("2026-04-02T00:00:00.000Z"),
      },
      externalBeneficiary: {
        bankInstructionSnapshot: {
          accountNo: "801455650838",
          bankAddress: null,
          bankCountry: "China",
          bankName: "HSBC HONG KONG",
          beneficiaryName: "HINA DEV CO., LIMITED",
          bic: "123123",
          corrAccount: null,
          iban: "123123",
          label: "main",
          swift: "HSBCHKHHHKH",
        },
        beneficiaryCounterpartyId: null,
        beneficiarySnapshot: {
          country: "CHINA",
          displayName: "HINA DEV",
          inn: "123123",
          legalName: "HINA DEV CO., LIMITED",
        },
      },
      incomingReceipt: {
        contractNumber: "123123",
        expectedAmount: "123123",
        expectedAt: new Date("2026-04-17T00:00:00.000Z"),
        expectedCurrencyId: "00000000-0000-4000-8000-000000000101",
        invoiceNumber: "INV-1",
        payerCounterpartyId: null,
        payerSnapshot: null,
      },
      moneyRequest: {
        purpose: "Payment",
        sourceAmount: null,
        sourceCurrencyId: "00000000-0000-4000-8000-000000000104",
        targetCurrencyId: "00000000-0000-4000-8000-000000000101",
      },
      settlementDestination: {
        bankInstructionSnapshot: null,
        mode: null,
        requisiteId: null,
      },
      type: "payment",
    },
    nextAction: "Compose route",
    operationalState: {
      positions: [],
    },
    participants: [
      {
        counterpartyId: null,
        customerId: "00000000-0000-4000-8000-000000000211",
        displayName: "Customer",
        id: "participant-customer",
        organizationId: null,
        role: "customer",
      },
    ],
    relatedFormalDocuments: [],
    revision: 1,
    sectionCompleteness: [],
    summary: {
      agentId: null,
      agreementId: "agreement-1",
      calculationId: null,
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      customerId: "00000000-0000-4000-8000-000000000211",
      id: "b7ca5505-13bb-479c-b0db-274d10b424fb",
      sourceAmountMinor: null,
      sourceCurrencyId: null,
      status: "pricing",
      targetCurrencyId: null,
      type: "payment",
      updatedAt: new Date("2026-04-02T00:00:00.000Z"),
    },
    timeline: [],
    transitionReadiness: [],
  };
}

function createTemplate(): DealRouteTemplate {
  return {
    costComponents: [],
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    dealType: "payment",
    description: null,
    id: "template-1",
    legs: [],
    name: "Payment template",
    participants: [
      {
        bindingKind: "deal_customer",
        code: "customer",
        displayNameTemplate: "Customer",
        id: "tp-1",
        metadata: {},
        partyId: null,
        partyKind: "customer",
        requisiteId: null,
        role: "source_customer",
        sequence: 1,
      },
      {
        bindingKind: "deal_beneficiary",
        code: "beneficiary",
        displayNameTemplate: "Beneficiary",
        id: "tp-2",
        metadata: {},
        partyId: null,
        partyKind: "counterparty",
        requisiteId: null,
        role: "destination_beneficiary",
        sequence: 2,
      },
    ],
    status: "published",
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
  };
}

describe("route template resolution", () => {
  it("returns an actionable error when deal_beneficiary is only a manual snapshot", () => {
    expect(() =>
      resolveRouteTemplateForDeal({
        deal: createDeal(),
        template: createTemplate(),
      }),
    ).toThrow(
      "has only manual beneficiary details. Select a linked beneficiary counterparty so beneficiaryCounterpartyId is set.",
    );
  });
});
