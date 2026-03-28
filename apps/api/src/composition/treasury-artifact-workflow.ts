import type { CurrenciesService } from "@bedrock/currencies";
import {
  type DocumentsModule,
  DocumentValidationError,
} from "@bedrock/documents";
import type { Database, Transaction } from "@bedrock/platform/persistence";
import {
  IncomingInvoicePayloadSchema,
  PaymentOrderInputSchema,
  type PaymentOrderExecutionStatus,
} from "@bedrock/plugin-documents-commercial/validation";
import type { TreasuryModule } from "@bedrock/treasury";
import { DrizzleTreasuryCoreRepository } from "@bedrock/treasury/adapters/drizzle";
import { minorToAmountString } from "@bedrock/shared/money";

type TreasuryDocumentLinkKind = "instruction" | "obligation" | "operation";

type CreateDraftInput =
  Parameters<DocumentsModule["documents"]["commands"]["createDraft"]>[0];

type TreasuryArtifactDocument = Awaited<
  ReturnType<DocumentsModule["documents"]["queries"]["listByIds"]>
>[number];

type TreasuryArtifactDraft = Awaited<
  ReturnType<DocumentsModule["documents"]["commands"]["createDraft"]>
>;

type DocumentsModuleFactory = (tx: Transaction) => Pick<DocumentsModule, "documents">;

type TreasuryArtifactsRepository = Pick<
  DrizzleTreasuryCoreRepository,
  "insertDocumentLinks"
>;

export interface TreasuryArtifactWorkflow {
  createPaymentOrderArtifact(input: {
    operationId: string;
    actorUserId: string;
    requestContext?: CreateDraftInput["requestContext"];
  }): Promise<{
    artifact: TreasuryArtifactDocument;
    created: boolean;
    linkKinds: TreasuryDocumentLinkKind[];
  }>;
}

export interface TreasuryArtifactWorkflowDeps {
  createDocumentsModule: DocumentsModuleFactory;
  currenciesService: Pick<CurrenciesService, "findById">;
  db: Database;
  documentsModule: Pick<DocumentsModule, "documents">;
  treasuryModule: Pick<TreasuryModule, "operations">;
  createTreasuryArtifactsRepository?: (
    tx: Transaction,
  ) => TreasuryArtifactsRepository;
}

function buildLinksByDocumentId(
  links: Awaited<
    ReturnType<TreasuryModule["operations"]["queries"]["listOperationDocumentLinks"]>
  >,
) {
  const byDocumentId = new Map<string, Set<TreasuryDocumentLinkKind>>();

  for (const link of links) {
    const existing = byDocumentId.get(link.documentId) ?? new Set();
    existing.add(link.linkKind);
    byDocumentId.set(link.documentId, existing);
  }

  return byDocumentId;
}

function resolvePaymentOrderExecutionStatus(input: {
  eventKinds: string[];
}): PaymentOrderExecutionStatus {
  if (
    input.eventKinds.some((eventKind) =>
      ["accepted", "fee_charged", "manual_adjustment", "settled", "submitted"].includes(
        eventKind,
      ),
    )
  ) {
    return "sent";
  }

  return "prepared";
}

function assertTerminalArtifactStateAbsent(input: { eventKinds: string[] }) {
  if (input.eventKinds.includes("failed")) {
    throw new DocumentValidationError(
      "Нельзя сформировать payment order после ошибки исполнения. Используйте карточку операции и связанные события как финальный источник правды.",
    );
  }

  if (input.eventKinds.includes("returned")) {
    throw new DocumentValidationError(
      "Нельзя сформировать payment order после возврата. Артефакт нужно создавать до возвратного исхода исполнения.",
    );
  }

  if (input.eventKinds.includes("voided")) {
    throw new DocumentValidationError(
      "Нельзя сформировать payment order после аннулирования операции.",
    );
  }
}

function resolveSinglePayoutInstruction(input: {
  instructionItems: Awaited<
    ReturnType<TreasuryModule["operations"]["queries"]["getOperationTimeline"]>
  >["instructionItems"];
}): NonNullable<
  Awaited<
    ReturnType<TreasuryModule["operations"]["queries"]["getOperationTimeline"]>
  >["instructionItems"][number]
> {
  const instructions = input.instructionItems.filter(
    (instruction) => instruction.destinationEndpointId !== null,
  );

  if (instructions.length !== 1) {
    throw new DocumentValidationError(
      "Для генерации payment order нужен ровно один маршрут исполнения с реквизитами получателя.",
    );
  }

  const [instruction] = instructions;

  if (!instruction) {
    throw new DocumentValidationError(
      "Не удалось определить инструкцию для генерации payment order.",
    );
  }

  return instruction;
}

function resolveSingleIncomingInvoiceArtifact(input: {
  documents: TreasuryArtifactDocument[];
  linkKindsByDocumentId: Map<string, Set<TreasuryDocumentLinkKind>>;
}): TreasuryArtifactDocument {
  const invoices = input.documents.filter((item) => {
    if (item.document.docType !== "incoming_invoice") {
      return false;
    }

    return input.linkKindsByDocumentId.get(item.document.id)?.has("obligation");
  });

  if (invoices.length !== 1) {
    throw new DocumentValidationError(
      "Для генерации payment order нужен ровно один связанный posted incoming_invoice.",
    );
  }

  const [invoice] = invoices;

  if (!invoice) {
    throw new DocumentValidationError(
      "Не удалось определить incoming_invoice для генерации payment order.",
    );
  }

  return invoice;
}

export function createTreasuryArtifactWorkflow(
  deps: TreasuryArtifactWorkflowDeps,
): TreasuryArtifactWorkflow {
  const createTreasuryArtifactsRepository =
    deps.createTreasuryArtifactsRepository ??
    ((tx: Transaction) => new DrizzleTreasuryCoreRepository(tx));

  async function createPaymentOrderArtifact(input: {
    operationId: string;
    actorUserId: string;
    requestContext?: CreateDraftInput["requestContext"];
  }) {
    const [operationTimeline, links] = await Promise.all([
      deps.treasuryModule.operations.queries.getOperationTimeline({
        operationId: input.operationId,
      }),
      deps.treasuryModule.operations.queries.listOperationDocumentLinks({
        operationId: input.operationId,
      }),
    ]);
    const documentIds = [...new Set(links.map((link) => link.documentId))];
    const documents =
      await deps.documentsModule.documents.queries.listByIds(documentIds);
    const linkKindsByDocumentId = buildLinksByDocumentId(links);

    const existingPaymentOrder = documents.find(
      (item) => item.document.docType === "payment_order",
    );

    if (existingPaymentOrder) {
    return {
      artifact: existingPaymentOrder,
      created: false,
      linkKinds: [
          ...(linkKindsByDocumentId.get(existingPaymentOrder.document.id) ?? []),
        ] as TreasuryDocumentLinkKind[],
      };
    }

    if (operationTimeline.operation.operationKind !== "payout") {
      throw new DocumentValidationError(
        "Артефакт payment order можно сформировать только для сценария выплаты.",
      );
    }

    if (
      !operationTimeline.operation.sourceAccountId ||
      !operationTimeline.operation.sourceAmountMinor ||
      !operationTimeline.operation.sourceAssetId
    ) {
      throw new DocumentValidationError(
        "У payout-операции не хватает исходного счета, суммы или валюты для генерации payment order.",
      );
    }

    assertTerminalArtifactStateAbsent({
      eventKinds: operationTimeline.eventItems.map((item) => item.eventKind),
    });

    const instruction = resolveSinglePayoutInstruction({
      instructionItems: operationTimeline.instructionItems,
    });
    const incomingInvoice = resolveSingleIncomingInvoiceArtifact({
      documents,
      linkKindsByDocumentId,
    });
    const incomingInvoicePayload = IncomingInvoicePayloadSchema.parse(
      incomingInvoice.document.payload,
    );
    const fundingCurrency = await deps.currenciesService.findById(
      operationTimeline.operation.sourceAssetId,
    );

    const paymentOrderInput = PaymentOrderInputSchema.parse({
      contour: incomingInvoicePayload.contour,
      occurredAt: instruction.createdAt.toISOString(),
      incomingInvoiceDocumentId: incomingInvoice.document.id,
      counterpartyId: incomingInvoicePayload.counterpartyId,
      counterpartyRequisiteId: instruction.destinationEndpointId,
      organizationId:
        incomingInvoicePayload.organizationId ??
        operationTimeline.operation.executingEntityId,
      organizationRequisiteId: operationTimeline.operation.sourceAccountId,
      amount: minorToAmountString(
        operationTimeline.operation.sourceAmountMinor,
        {
          currency: fundingCurrency.code,
        },
      ),
      currency: fundingCurrency.code,
      allocatedCurrency: incomingInvoicePayload.currency,
      executionStatus: resolvePaymentOrderExecutionStatus({
        eventKinds: operationTimeline.eventItems.map((item) => item.eventKind),
      }),
      memo: operationTimeline.operation.memo ?? undefined,
    });

    const artifact = await deps.db.transaction(async (tx) => {
      const documentsModule = deps.createDocumentsModule(tx);
      const repository = createTreasuryArtifactsRepository(tx);
      const created = await documentsModule.documents.commands.createDraft({
        actorUserId: input.actorUserId,
        createIdempotencyKey: `treasury:operation:payment_order_artifact:${input.operationId}:${instruction.id}`,
        docType: "payment_order",
        payload: paymentOrderInput,
        requestContext: input.requestContext,
      });

      await repository.insertDocumentLinks([
        {
          documentId: created.document.id,
          linkKind: "operation",
          targetId: operationTimeline.operation.id,
        },
        {
          documentId: created.document.id,
          linkKind: "instruction",
          targetId: instruction.id,
        },
      ]);

      return created;
    });

    return {
      artifact,
      created: true,
      linkKinds: ["operation", "instruction"] satisfies TreasuryDocumentLinkKind[],
    };
  }

  return {
    createPaymentOrderArtifact,
  };
}
