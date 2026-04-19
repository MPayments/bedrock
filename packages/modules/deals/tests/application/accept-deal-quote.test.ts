import { describe, expect, it, vi } from "vitest";

import { createModuleRuntime } from "@bedrock/shared/core";

import { AcceptDealQuoteCommand } from "../../src/application/commands/accept-deal-quote";
import { DealQuoteInactiveError } from "../../src/errors";

function createLogger() {
  const logger = {
    child: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };
  logger.child.mockReturnValue(logger);
  return logger;
}

describe("accept deal quote command", () => {
  it("is idempotent when the same active quote is already accepted for the current revision", async () => {
    const existing = {
      acceptedQuote: {
        acceptedAt: new Date("2026-04-01T10:00:00.000Z"),
        acceptedByUserId: "user-1",
        agreementVersionId: null,
        dealId: "00000000-0000-4000-8000-000000000010",
        dealRevision: 2,
        expiresAt: new Date("2026-04-01T11:00:00.000Z"),
        id: "00000000-0000-4000-8000-000000000020",
        quoteId: "00000000-0000-4000-8000-000000000030",
        quoteStatus: "active",
        replacedByQuoteId: null,
        revokedAt: null,
        usedAt: null,
        usedDocumentId: null,
      },
      intake: {
        common: {
          applicantCounterpartyId: "00000000-0000-4000-8000-000000000040",
          customerNote: null,
          requestedExecutionDate: new Date("2026-04-05T00:00:00.000Z"),
        },
        externalBeneficiary: {
          bankInstructionSnapshot: {
            accountNo: "DE123",
            bankAddress: "Address",
            bankCountry: "DE",
            bankName: "Bank",
            beneficiaryName: "Beneficiary",
            bic: "DEUTDEFF",
            iban: "DE123",
            label: "Label",
            swift: "DEUTDEFF",
          },
          beneficiaryCounterpartyId: "00000000-0000-4000-8000-000000000041",
          beneficiarySnapshot: null,
        },
        incomingReceipt: {
          contractNumber: null,
          expectedAmount: null,
          expectedAt: null,
          invoiceNumber: null,
          payerCounterpartyId: null,
          payerSnapshot: null,
        },
        moneyRequest: {
          purpose: "Payment",
          sourceAmount: "1000.00",
          sourceCurrencyId: "00000000-0000-4000-8000-000000000050",
          targetCurrencyId: "00000000-0000-4000-8000-000000000051",
        },
        settlementDestination: {
          bankInstructionSnapshot: null,
          mode: null,
          requisiteId: null,
        },
        type: "payment" as const,
      },
      nextAction: "Create calculation from accepted quote",
      operationalState: {
        positions: [],
      },
      participants: [],
      relatedResources: {
        attachments: [],
        calculations: [],
        formalDocuments: [],
        quotes: [],
      },
      revision: 2,
      sectionCompleteness: [],
      summary: {
        agreementId: "00000000-0000-4000-8000-000000000002",
        agentId: null,
        calculationId: null,
        createdAt: new Date("2026-04-01T09:00:00.000Z"),
        id: "00000000-0000-4000-8000-000000000010",
        status: "submitted" as const,
        type: "payment" as const,
        updatedAt: new Date("2026-04-01T10:00:00.000Z"),
      },
      timeline: [],
    };

    const dealStore = {
      createDealQuoteAcceptance: vi.fn(),
      createDealTimelineEvents: vi.fn(),
      replaceDealOperationalPositions: vi.fn(),
      setDealRoot: vi.fn(),
      supersedeCurrentQuoteAcceptances: vi.fn(),
    };
    const tx = {
      dealReads: {
        findWorkflowById: vi.fn(async () => existing),
      },
      dealStore,
    };
    const commandUow = {
      run: vi.fn(async (work: (value: typeof tx) => Promise<unknown>) => work(tx)),
    };
    const command = new AcceptDealQuoteCommand(
      createModuleRuntime({
        generateUuid: () => "00000000-0000-4000-8000-000000000099",
        logger: createLogger(),
        now: () => new Date("2026-04-01T10:05:00.000Z"),
        service: "deals",
      }),
      commandUow as any,
      {
        findAgreementById: vi.fn(),
        findCalculationById: vi.fn(),
        findCounterpartyById: vi.fn(),
        findCurrencyById: vi.fn(),
        findCustomerById: vi.fn(),
        findQuoteById: vi.fn(async () => ({
          dealId: existing.summary.id,
          expiresAt: new Date("2026-04-01T11:00:00.000Z"),
          id: existing.acceptedQuote.quoteId,
          status: "active",
          usedAt: null,
          usedDocumentId: null,
        })),
        listActiveAgreementsByCustomerId: vi.fn(),
        validateSupportedCreateType: vi.fn(),
      } as any,
    );

    const result = await command.execute({
      actorUserId: "user-1",
      dealId: existing.summary.id,
      quoteId: existing.acceptedQuote.quoteId,
    });

    expect(result).toBe(existing);
    expect(dealStore.supersedeCurrentQuoteAcceptances).not.toHaveBeenCalled();
    expect(dealStore.createDealQuoteAcceptance).not.toHaveBeenCalled();
    expect(dealStore.createDealTimelineEvents).not.toHaveBeenCalled();
    expect(dealStore.setDealRoot).not.toHaveBeenCalled();
  });

  it("rejects accepting a quote whose ttl has already passed", async () => {
    const existing = {
      acceptedQuote: null,
      intake: {
        common: {
          applicantCounterpartyId: "00000000-0000-4000-8000-000000000040",
          customerNote: null,
          requestedExecutionDate: new Date("2026-04-05T00:00:00.000Z"),
        },
        externalBeneficiary: {
          bankInstructionSnapshot: null,
          beneficiaryCounterpartyId: null,
          beneficiarySnapshot: null,
        },
        incomingReceipt: {
          contractNumber: null,
          expectedAmount: null,
          expectedAt: null,
          invoiceNumber: null,
          payerCounterpartyId: null,
          payerSnapshot: null,
        },
        moneyRequest: {
          purpose: "Payment",
          sourceAmount: "1000.00",
          sourceCurrencyId: "00000000-0000-4000-8000-000000000050",
          targetCurrencyId: "00000000-0000-4000-8000-000000000051",
        },
        settlementDestination: {
          bankInstructionSnapshot: null,
          mode: null,
          requisiteId: null,
        },
        type: "payment" as const,
      },
      nextAction: "Accept quote",
      operationalState: {
        positions: [],
      },
      participants: [],
      relatedResources: {
        attachments: [],
        calculations: [],
        formalDocuments: [],
        quotes: [],
      },
      revision: 2,
      sectionCompleteness: [],
      summary: {
        agreementId: "00000000-0000-4000-8000-000000000002",
        agentId: null,
        calculationId: null,
        createdAt: new Date("2026-04-01T09:00:00.000Z"),
        id: "00000000-0000-4000-8000-000000000010",
        status: "submitted" as const,
        type: "payment" as const,
        updatedAt: new Date("2026-04-01T10:00:00.000Z"),
      },
      timeline: [],
    };

    const command = new AcceptDealQuoteCommand(
      createModuleRuntime({
        generateUuid: () => "00000000-0000-4000-8000-000000000099",
        logger: createLogger(),
        now: () => new Date("2026-04-01T10:05:00.000Z"),
        service: "deals",
      }),
      {
        run: vi.fn(async (work: (value: any) => Promise<unknown>) =>
          work({
            dealReads: {
              findWorkflowById: vi.fn(async () => existing),
            },
            dealStore: {
              createDealQuoteAcceptance: vi.fn(),
              createDealTimelineEvents: vi.fn(),
              replaceDealOperationalPositions: vi.fn(),
              setDealRoot: vi.fn(),
              supersedeCurrentQuoteAcceptances: vi.fn(),
            },
          })),
      } as any,
      {
        findAgreementById: vi.fn(),
        findCalculationById: vi.fn(),
        findCounterpartyById: vi.fn(),
        findCurrencyById: vi.fn(),
        findCustomerById: vi.fn(),
        findQuoteById: vi.fn(async () => ({
          dealId: existing.summary.id,
          expiresAt: new Date("2026-04-01T10:00:00.000Z"),
          id: "00000000-0000-4000-8000-000000000030",
          status: "active",
          usedAt: null,
          usedDocumentId: null,
        })),
        listActiveAgreementsByCustomerId: vi.fn(),
        validateSupportedCreateType: vi.fn(),
      } as any,
    );

    await expect(
      command.execute({
        actorUserId: "user-1",
        dealId: existing.summary.id,
        quoteId: "00000000-0000-4000-8000-000000000030",
      }),
    ).rejects.toThrowError(
      new DealQuoteInactiveError(
        "00000000-0000-4000-8000-000000000030",
        "expired",
      ),
    );
  });
});
