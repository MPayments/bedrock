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
  references.validateSupportedCreateType(input.intake.type);

  const [customer, agreement, applicant, sourceCurrency, targetCurrency] =
    await Promise.all([
      references.findCustomerById(input.customerId),
      resolveAgreement(input, references),
      input.intake.common.applicantCounterpartyId
        ? references.findCounterpartyById(
            input.intake.common.applicantCounterpartyId,
          )
        : Promise.resolve(null),
      input.intake.moneyRequest.sourceCurrencyId
        ? references.findCurrencyById(input.intake.moneyRequest.sourceCurrencyId)
        : Promise.resolve(null),
      input.intake.moneyRequest.targetCurrencyId
        ? references.findCurrencyById(input.intake.moneyRequest.targetCurrencyId)
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
    input.intake.common.applicantCounterpartyId &&
    !applicant
  ) {
    throw new NotFoundError(
      "Counterparty",
      input.intake.common.applicantCounterpartyId,
    );
  }

  if (input.intake.moneyRequest.sourceCurrencyId && !sourceCurrency) {
    throw new NotFoundError(
      "Currency",
      input.intake.moneyRequest.sourceCurrencyId,
    );
  }

  if (input.intake.moneyRequest.targetCurrencyId && !targetCurrency) {
    throw new NotFoundError(
      "Currency",
      input.intake.moneyRequest.targetCurrencyId,
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
          intake: validated.intake,
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
            acceptance: null,
            calculationId: null,
            intake: validated.intake,
            references: this.references,
            status: "draft",
          });

          await tx.dealStore.createDealRoot({
            agreementId: agreement.id,
            agentId: null,
            calculationId: null,
            customerId: validated.customerId,
            id: dealId,
            nextAction: rootState.nextAction,
            sourceAmountMinor: rootState.sourceAmountMinor,
            sourceCurrencyId: rootState.sourceCurrencyId,
            status: "draft",
            targetCurrencyId: rootState.targetCurrencyId,
            type: validated.intake.type,
          });
          await tx.dealStore.createDealIntakeSnapshot({
            dealId,
            revision: 1,
            snapshot: validated.intake,
          });
          await tx.dealStore.replaceDealLegs({
            dealId,
            legs: buildDealLegRows({
              dealId,
              generateUuid: () => this.runtime.generateUuid(),
              intake: validated.intake,
            }),
          });
          await tx.dealStore.replaceDealParticipants({
            dealId,
            participants: buildDealParticipantRows({
              agreement,
              customerId: validated.customerId,
              dealId,
              generateUuid: () => this.runtime.generateUuid(),
              intake: validated.intake,
            }),
          });
          await tx.dealStore.createDealTimelineEvents([
            createTimelinePayloadEvent({
              actorUserId: validated.actorUserId,
              dealId,
              generateUuid: () => this.runtime.generateUuid(),
              occurredAt: now,
              payload: {
                intakeType: validated.intake.type,
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
