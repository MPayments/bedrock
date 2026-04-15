import { z } from "zod";

import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { ModuleRuntime } from "@bedrock/shared/core";
import { NotFoundError } from "@bedrock/shared/core/errors";

import { DEALS_CREATE_IDEMPOTENCY_SCOPE } from "../../domain/constants";
import {
  DealActiveAgreementAmbiguousError,
  DealActiveAgreementNotFoundError,
  DealAgreementCustomerMismatchError,
  DealAgreementInactiveError,
  DealNotFoundError,
} from "../../errors";
import {
  CreateDealDraftInputSchema,
  type CreateDealDraftInput,
} from "../contracts/commands";
import type { DealWorkflowProjection } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import type {
  DealAgreementReference,
  DealReferencesPort,
} from "../ports/references.port";
import {
  buildDealLegRows,
  buildDealOperationalPositionRows,
  buildDealParticipantRows,
  createTimelinePayloadEvent,
  deriveDealRootState,
} from "../shared/workflow-state";

const CreateDealDraftCommandInputSchema = CreateDealDraftInputSchema.extend({
  actorUserId: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1).max(255),
});

type CreateDealDraftCommandInput = CreateDealDraftInput & {
  actorUserId: string;
  idempotencyKey: string;
};

async function resolveAgreement(
  input: CreateDealDraftCommandInput,
  references: DealReferencesPort,
): Promise<DealAgreementReference> {
  if (input.agreementId) {
    const agreement = await references.findAgreementById(input.agreementId);

    if (!agreement) {
      throw new NotFoundError("Agreement", input.agreementId);
    }

    return agreement;
  }

  const activeAgreements = await references.listActiveAgreementsByCustomerId(
    input.customerId,
  );

  if (activeAgreements.length === 0) {
    throw new DealActiveAgreementNotFoundError(input.customerId);
  }

  if (activeAgreements.length > 1) {
    throw new DealActiveAgreementAmbiguousError(input.customerId);
  }

  return activeAgreements[0]!;
}

async function validateDraftReferences(
  input: CreateDealDraftCommandInput,
  references: DealReferencesPort,
) {
  references.validateSupportedCreateType(input.header.type);

  const [customer, agreement, applicant, sourceCurrency, targetCurrency] =
    await Promise.all([
      references.findCustomerById(input.customerId),
      resolveAgreement(input, references),
      input.header.common.applicantCounterpartyId
        ? references.findCounterpartyById(
            input.header.common.applicantCounterpartyId,
          )
        : Promise.resolve(null),
      input.header.moneyRequest.sourceCurrencyId
        ? references.findCurrencyById(input.header.moneyRequest.sourceCurrencyId)
        : Promise.resolve(null),
      input.header.moneyRequest.targetCurrencyId
        ? references.findCurrencyById(input.header.moneyRequest.targetCurrencyId)
        : Promise.resolve(null),
    ]);

  if (!customer) {
    throw new NotFoundError("Customer", input.customerId);
  }

  if (!agreement.isActive) {
    throw new DealAgreementInactiveError(agreement.id);
  }

  if (agreement.customerId !== input.customerId) {
    throw new DealAgreementCustomerMismatchError(agreement.id, input.customerId);
  }

  if (
    input.header.common.applicantCounterpartyId &&
    !applicant
  ) {
    throw new NotFoundError(
      "Counterparty",
      input.header.common.applicantCounterpartyId,
    );
  }

  if (input.header.moneyRequest.sourceCurrencyId && !sourceCurrency) {
    throw new NotFoundError(
      "Currency",
      input.header.moneyRequest.sourceCurrencyId,
    );
  }

  if (input.header.moneyRequest.targetCurrencyId && !targetCurrency) {
    throw new NotFoundError(
      "Currency",
      input.header.moneyRequest.targetCurrencyId,
    );
  }

  return { agreement };
}

export class CreateDealDraftCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
    private readonly idempotency: IdempotencyPort,
    private readonly references: DealReferencesPort,
  ) {}

  async execute(
    raw: CreateDealDraftCommandInput,
  ): Promise<DealWorkflowProjection> {
    const validated = CreateDealDraftCommandInputSchema.parse(raw);
    const { agreement } = await validateDraftReferences(
      validated,
      this.references,
    );

    return this.commandUow.run((tx) =>
      this.idempotency.withIdempotencyTx({
        tx: tx.transaction,
        scope: DEALS_CREATE_IDEMPOTENCY_SCOPE,
        idempotencyKey: validated.idempotencyKey,
        request: {
          agreementId: agreement.id,
          customerId: validated.customerId,
          header: validated.header,
        },
        actorId: validated.actorUserId,
        serializeResult: (result) => ({ dealId: result.summary.id }),
        loadReplayResult: async ({ storedResult }) => {
          const dealId = String(storedResult?.dealId ?? "");
          const replayed = await tx.dealReads.findWorkflowById(dealId);

          if (!replayed) {
            throw new DealNotFoundError(dealId);
          }

          return replayed;
        },
        handler: async () => {
          const now = this.runtime.now();
          const dealId = this.runtime.generateUuid();
          const rootState = await deriveDealRootState({
            calculationId: null,
            header: validated.header,
            references: this.references,
            status: "draft",
          });

          await tx.dealStore.createDealRoot({
            agreementId: agreement.id,
            agentId: null,
            calculationId: null,
            customerId: validated.customerId,
            header: validated.header,
            headerRevision: 1,
            id: dealId,
            nextAction: rootState.nextAction,
            sourceAmountMinor: rootState.sourceAmountMinor,
            sourceCurrencyId: rootState.sourceCurrencyId,
            status: "draft",
            targetCurrencyId: rootState.targetCurrencyId,
            type: validated.header.type,
          });
          await tx.dealStore.replaceDealLegs({
            dealId,
            legs: buildDealLegRows({
              dealId,
              generateUuid: () => this.runtime.generateUuid(),
              header: validated.header,
            }),
          });
          await tx.dealStore.replaceDealParticipants({
            dealId,
            participants: buildDealParticipantRows({
              agreement,
              customerId: validated.customerId,
              dealId,
              generateUuid: () => this.runtime.generateUuid(),
              header: validated.header,
            }),
          });
          await tx.dealStore.createDealTimelineEvents([
            createTimelinePayloadEvent({
              actorUserId: validated.actorUserId,
              dealId,
              generateUuid: () => this.runtime.generateUuid(),
              occurredAt: now,
              payload: {
                dealType: validated.header.type,
                status: "draft",
              },
              type: "deal_created",
              visibility: "customer_safe",
            }),
          ]);

          const created = await tx.dealReads.findWorkflowById(dealId);

          if (!created) {
            throw new DealNotFoundError(dealId);
          }

          await tx.dealStore.setDealRoot({
            dealId,
            nextAction: created.nextAction,
          });
          await tx.dealStore.replaceDealOperationalPositions({
            dealId,
            positions: buildDealOperationalPositionRows({
              dealId,
              generateUuid: () => this.runtime.generateUuid(),
              operationalState: created.operationalState,
            }),
          });

          return created;
        },
      }),
    );
  }
}
