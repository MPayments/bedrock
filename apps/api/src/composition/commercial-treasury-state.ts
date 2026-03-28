import type { CurrenciesService } from "@bedrock/currencies";
import type { Database } from "@bedrock/platform/persistence";
import type {
  CommercialTreasuryStatePort,
} from "@bedrock/plugin-documents-commercial";
import {
  IncomingInvoicePayloadSchema,
  OutgoingInvoicePayloadSchema,
  PaymentOrderPayloadSchema,
} from "@bedrock/plugin-documents-commercial/validation";
import { DocumentValidationError } from "@bedrock/plugin-documents-sdk";
import type { TreasuryModule } from "@bedrock/treasury";
import { DrizzleTreasuryCoreRepository } from "@bedrock/treasury/adapters/drizzle";

interface RequisiteRecord {
  id: string;
  ownerType: string;
  ownerId: string;
  providerId: string;
  currencyId: string;
  kind: "bank" | "blockchain" | "custodian" | "exchange";
  label: string;
  beneficiaryName: string | null;
  institutionName: string | null;
  accountNo: string | null;
  iban: string | null;
  swift: string | null;
  network: string | null;
  address: string | null;
  memoTag: string | null;
  accountRef: string | null;
  subaccountRef: string | null;
}

interface RequisitesService {
  findById(requisiteId: string): Promise<RequisiteRecord>;
  resolveBindings(input: {
    requisiteIds: string[];
  }): Promise<
    {
      requisiteId: string;
      organizationId: string;
      bookId: string;
      currencyCode: string;
      postingAccountNo: string;
      bookAccountInstanceId: string;
    }[]
  >;
}

function requireBinding(
  bindings: Awaited<ReturnType<RequisitesService["resolveBindings"]>>,
  requisiteId: string,
) {
  const binding = bindings.find((item) => item.requisiteId === requisiteId);

  if (!binding) {
    throw new DocumentValidationError(
      `Organization requisite binding is missing: ${requisiteId}`,
    );
  }

  return binding;
}

function resolveTreasuryAccountKind(requisite: RequisiteRecord) {
  switch (requisite.kind) {
    case "bank":
      return "bank" as const;
    case "exchange":
      return "exchange" as const;
    case "blockchain":
      return "wallet" as const;
    case "custodian":
      return "custodial" as const;
  }
}

function resolveEndpointDescriptor(requisite: RequisiteRecord) {
  if (requisite.kind === "blockchain") {
    const value = requisite.address ?? requisite.accountRef;
    if (!value) {
      throw new DocumentValidationError(
        `Blockchain requisite ${requisite.id} is missing address`,
      );
    }

    return {
      endpointType: "wallet_address",
      value,
    };
  }

  const value =
    requisite.iban ??
    requisite.accountNo ??
    requisite.accountRef ??
    requisite.subaccountRef;

  if (!value) {
    throw new DocumentValidationError(
      `Requisite ${requisite.id} is missing an addressable endpoint value`,
    );
  }

  return {
    endpointType: requisite.iban
      ? "iban"
      : requisite.accountNo
        ? "account_no"
        : requisite.accountRef
          ? "account_ref"
          : "subaccount_ref",
    value,
  };
}

async function ensureTreasuryAccountForRequisite(input: {
  repo: DrizzleTreasuryCoreRepository;
  requisite: RequisiteRecord;
}) {
  const existing = await input.repo.findTreasuryAccount(input.requisite.id);
  if (existing) {
    return existing.id;
  }

  await input.repo.insertTreasuryAccount({
    id: input.requisite.id,
    kind: resolveTreasuryAccountKind(input.requisite),
    ownerEntityId: input.requisite.ownerId,
    operatorEntityId: input.requisite.ownerId,
    assetId: input.requisite.currencyId,
    provider: input.requisite.providerId,
    networkOrRail: input.requisite.network,
    accountReference: `requisite:${input.requisite.id}`,
    reconciliationMode: null,
    finalityModel: null,
    segregationModel: null,
    canReceive: true,
    canSend: true,
    metadata: {
      label: input.requisite.label,
      institutionName: input.requisite.institutionName,
      beneficiaryName: input.requisite.beneficiaryName,
      accountNo: input.requisite.accountNo,
      iban: input.requisite.iban,
      swift: input.requisite.swift,
      address: input.requisite.address,
      accountRef: input.requisite.accountRef,
      subaccountRef: input.requisite.subaccountRef,
    },
    archivedAt: null,
  });

  return input.requisite.id;
}

async function ensureCounterpartyEndpointForRequisite(input: {
  repo: DrizzleTreasuryCoreRepository;
  requisite: RequisiteRecord;
}) {
  const existing = await input.repo.findCounterpartyEndpoint(input.requisite.id);
  if (existing) {
    return existing.id;
  }

  const endpoint = resolveEndpointDescriptor(input.requisite);

  await input.repo.insertCounterpartyEndpoint({
    id: input.requisite.id,
    counterpartyId: input.requisite.ownerId,
    assetId: input.requisite.currencyId,
    endpointType: endpoint.endpointType,
    value: endpoint.value,
    label: input.requisite.label,
    memoTag: input.requisite.memoTag,
    metadata: {
      providerId: input.requisite.providerId,
      kind: input.requisite.kind,
    },
    archivedAt: null,
  });

  return input.requisite.id;
}

async function ensureDocumentLink(input: {
  repo: DrizzleTreasuryCoreRepository;
  documentId: string;
  linkKind: "instruction" | "obligation" | "operation";
  targetId: string;
}) {
  await input.repo.insertDocumentLinks([
    {
      documentId: input.documentId,
      linkKind: input.linkKind,
      targetId: input.targetId,
    },
  ]);
}

export function createCommercialTreasuryState(input: {
  db: Database;
  currenciesService: Pick<CurrenciesService, "findByCode">;
  requisitesService: RequisitesService;
  treasuryModule: TreasuryModule;
}): CommercialTreasuryStatePort {
  const repo = new DrizzleTreasuryCoreRepository(input.db);

  return {
    async ensureIncomingInvoiceObligation({ document }) {
      const existingLinks = await repo.listDocumentLinks(document.id);
      const existing = existingLinks.find((item) => item.linkKind === "obligation");
      if (existing) {
        return { obligationId: existing.targetId };
      }

      const payload = IncomingInvoicePayloadSchema.parse({
        ...document.payload,
        occurredAt: document.occurredAt,
      });
      const [binding, currency] = await Promise.all([
        input.requisitesService
          .resolveBindings({ requisiteIds: [payload.organizationRequisiteId] })
          .then((rows) => requireBinding(rows, payload.organizationRequisiteId)),
        input.currenciesService.findByCode(payload.currency),
      ]);

      const existingObligation = await repo.findObligation(document.id);
      const obligationId = existingObligation
        ? existingObligation.id
        : (
            await repo.insertObligation({
              id: document.id,
              obligationKind: "ap_invoice",
              debtorEntityId: payload.organizationId ?? binding.organizationId,
              creditorEntityId: payload.counterpartyId,
              beneficialOwnerType: "customer",
              beneficialOwnerId: payload.customerId,
              assetId: currency.id,
              amountMinor: BigInt(payload.amountMinor),
              dueAt: document.occurredAt,
              memo: payload.memo ?? null,
              payload: {
                contour: payload.contour,
                documentId: document.id,
                externalBasis: payload.externalBasis ?? null,
              },
            })
          ).id;

      await ensureDocumentLink({
        repo,
        documentId: document.id,
        linkKind: "obligation",
        targetId: obligationId,
      });

      return { obligationId };
    },

    async ensureOutgoingInvoiceObligation({ document }) {
      const existingLinks = await repo.listDocumentLinks(document.id);
      const existing = existingLinks.find((item) => item.linkKind === "obligation");
      if (existing) {
        return { obligationId: existing.targetId };
      }

      const payload = OutgoingInvoicePayloadSchema.parse({
        ...document.payload,
        occurredAt: document.occurredAt,
      });
      const [binding, currency] = await Promise.all([
        input.requisitesService
          .resolveBindings({ requisiteIds: [payload.organizationRequisiteId] })
          .then((rows) => requireBinding(rows, payload.organizationRequisiteId)),
        input.currenciesService.findByCode(payload.currency),
      ]);

      const existingObligation = await repo.findObligation(document.id);
      const obligationId = existingObligation
        ? existingObligation.id
        : (
            await repo.insertObligation({
              id: document.id,
              obligationKind: "ar_invoice",
              debtorEntityId: payload.counterpartyId,
              creditorEntityId: payload.organizationId ?? binding.organizationId,
              beneficialOwnerType: null,
              beneficialOwnerId: null,
              assetId: currency.id,
              amountMinor: BigInt(payload.amountMinor),
              dueAt: document.occurredAt,
              memo: payload.memo ?? null,
              payload: {
                contour: payload.contour,
                documentId: document.id,
              },
            })
          ).id;

      await ensureDocumentLink({
        repo,
        documentId: document.id,
        linkKind: "obligation",
        targetId: obligationId,
      });

      return { obligationId };
    },

    async ensurePaymentOrderPayout({ document }) {
      const payload = PaymentOrderPayloadSchema.parse({
        ...document.payload,
        occurredAt: document.occurredAt,
      });

      if (payload.sourcePaymentOrderDocumentId) {
        throw new DocumentValidationError(
          "payment_order resolutions are no longer supported; use treasury execution events instead",
        );
      }

      if (payload.executionStatus !== "sent") {
        throw new DocumentValidationError(
          `payment_order executionStatus=${payload.executionStatus} is no longer supported; create the base payout request and use treasury execution events`,
        );
      }

      const [bindingRows, organizationRequisite, counterpartyRequisite, fundingAsset] =
        await Promise.all([
          input.requisitesService.resolveBindings({
            requisiteIds: [payload.organizationRequisiteId],
          }),
          input.requisitesService.findById(payload.organizationRequisiteId),
          input.requisitesService.findById(payload.counterpartyRequisiteId),
          input.currenciesService.findByCode(payload.fundingCurrency),
        ]);
      const binding = requireBinding(bindingRows, payload.organizationRequisiteId);

      await ensureTreasuryAccountForRequisite({
        repo,
        requisite: organizationRequisite,
      });
      await ensureCounterpartyEndpointForRequisite({
        repo,
        requisite: counterpartyRequisite,
      });

      const invoiceObligationId = payload.incomingInvoiceDocumentId;
      const obligation = await repo.findObligation(invoiceObligationId);
      if (!obligation) {
        throw new DocumentValidationError(
          `incoming_invoice ${invoiceObligationId} must be posted before payment_order`,
        );
      }

      const operationIdempotencyKey = `documents:payment_order:operation:${document.id}`;
      let operation =
        (await input.treasuryModule.controls.queries.findOperationByIdempotencyKey(
          operationIdempotencyKey,
        )) ??
        null;

      if (!operation) {
        operation = await input.treasuryModule.operations.commands.issueOperation({
          operationKind: "payout",
          idempotencyKey: operationIdempotencyKey,
          economicOwnerEntityId: payload.organizationId ?? binding.organizationId,
          executingEntityId: binding.organizationId,
          cashHolderEntityId: binding.organizationId,
          beneficialOwnerType: "customer",
          beneficialOwnerId: payload.customerId,
          obligationIds: [invoiceObligationId],
          sourceAccountId: payload.organizationRequisiteId,
          assetId: fundingAsset.id,
          amountMinor: payload.fundingAmountMinor,
          memo: payload.memo ?? null,
        });
      }

      if (operation.instructionStatus === "draft") {
        operation = await input.treasuryModule.operations.commands.approveOperation({
          operationId: operation.id,
        });
      }

      if (operation.instructionStatus === "approved") {
        operation =
          await input.treasuryModule.operations.commands.reserveOperationFunds({
            operationId: operation.id,
          });
      }

      let timeline =
        await input.treasuryModule.operations.queries.getOperationTimeline({
          operationId: operation.id,
        });

      let instructionId = timeline.instructions[0] ?? null;
      if (!instructionId) {
        const instruction =
          await input.treasuryModule.executions.commands.createExecutionInstruction(
            {
              operationId: operation.id,
              sourceAccountId: payload.organizationRequisiteId,
              destinationEndpointId: payload.counterpartyRequisiteId,
              submissionChannel: "manual",
              assetId: fundingAsset.id,
              amountMinor: payload.fundingAmountMinor,
              metadata: {
                documentId: document.id,
                quoteSnapshot: payload.quoteSnapshot ?? null,
              },
            },
          );
        instructionId = instruction.id;
        timeline = await input.treasuryModule.operations.queries.getOperationTimeline({
          operationId: operation.id,
        });
      }

      const instructionEvents = await repo.listInstructionEvents(instructionId);
      let submittedEvent = instructionEvents.find((item) => item.eventKind === "submitted");

      if (!submittedEvent) {
        const recorded =
          await input.treasuryModule.executions.commands.recordExecutionEvent({
            instructionId,
            eventKind: "submitted",
            metadata: {
              documentId: document.id,
            },
          });
        submittedEvent = recorded.event;
      }

      await repo.insertDocumentLinks([
        {
          documentId: document.id,
          linkKind: "operation",
          targetId: operation.id,
        },
        {
          documentId: document.id,
          linkKind: "instruction",
          targetId: instructionId,
        },
      ]);

      return {
        operationId: operation.id,
        instructionId,
        submittedEventId: submittedEvent?.id ?? null,
      };
    },

    async listDocumentLinks(documentId) {
      return (await repo.listDocumentLinks(documentId)).map((item) => ({
        linkKind: item.linkKind,
        targetId: item.targetId,
      }));
    },

    async getPaymentOrderStatus({ documentId }) {
      const links = await repo.listDocumentLinks(documentId);
      const operationId =
        links.find((item) => item.linkKind === "operation")?.targetId ?? null;
      const instructionId =
        links.find((item) => item.linkKind === "instruction")?.targetId ?? null;

      if (!operationId) {
        return null;
      }

      const [operation, instruction, submittedEvent] = await Promise.all([
        repo.findOperation(operationId),
        instructionId ? repo.findInstruction(instructionId) : Promise.resolve(null),
        instructionId
          ? repo.listInstructionEvents(instructionId).then((rows) =>
              rows.find((row) => row.eventKind === "submitted") ?? null,
            )
          : Promise.resolve(null),
      ]);

      return {
        operationId,
        instructionId,
        operationStatus: operation?.instructionStatus ?? null,
        instructionStatus: instruction?.instructionStatus ?? null,
        submittedEventId: submittedEvent?.id ?? null,
      };
    },
  };
}
