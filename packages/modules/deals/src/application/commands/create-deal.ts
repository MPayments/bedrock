import { z } from "zod";

import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { ModuleRuntime } from "@bedrock/shared/core";
import { NotFoundError } from "@bedrock/shared/core/errors";
import { toMinorAmountString } from "@bedrock/shared/money";

import { DEALS_CREATE_IDEMPOTENCY_SCOPE } from "../../domain/constants";
import {
  DealActiveAgreementAmbiguousError,
  DealActiveAgreementNotFoundError,
  DealAgreementCustomerMismatchError,
  DealAgreementInactiveError,
  DealCalculationInactiveError,
  DealNotFoundError,
  DealRequestedAmountCurrencyMismatchError,
} from "../../errors";
import {
  CreateDealInputSchema,
  type CreateDealInput,
} from "../contracts/commands";
import type { DealDetails } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import type {
  DealAgreementReference,
  DealReferencesPort,
} from "../ports/references.port";

const CreateDealCommandInputSchema = CreateDealInputSchema.extend({
  actorUserId: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1).max(255),
});

type CreateDealCommandInput = CreateDealInput & {
  actorUserId: string;
  idempotencyKey: string;
};

async function resolveAgreement(
  input: CreateDealCommandInput,
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

async function validateDealReferences(
  input: CreateDealCommandInput,
  references: DealReferencesPort,
) {
  references.validateSupportedCreateType(input.type);

  const [customer, agreement, calculation, counterparty, requestedCurrency] =
    await Promise.all([
      references.findCustomerById(input.customerId),
      resolveAgreement(input, references),
      input.calculationId
        ? references.findCalculationById(input.calculationId)
        : Promise.resolve(null),
      input.counterpartyId
        ? references.findCounterpartyById(input.counterpartyId)
        : Promise.resolve(null),
      input.requestedCurrencyId
        ? references.findCurrencyById(input.requestedCurrencyId)
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

  if (input.calculationId && !calculation) {
    throw new NotFoundError("Calculation", input.calculationId);
  }

  if (calculation && !calculation.isActive) {
    throw new DealCalculationInactiveError(input.calculationId!);
  }

  if (input.counterpartyId && !counterparty) {
    throw new NotFoundError("Counterparty", input.counterpartyId);
  }

  if ((input.requestedAmount == null) !== (input.requestedCurrencyId == null)) {
    throw new DealRequestedAmountCurrencyMismatchError();
  }

  if (input.requestedCurrencyId && !requestedCurrency) {
    throw new NotFoundError("Currency", input.requestedCurrencyId);
  }

  return {
    agreement,
    calculation,
    requestedAmountMinor:
      input.requestedAmount && requestedCurrency
        ? BigInt(
            toMinorAmountString(input.requestedAmount, requestedCurrency.code),
          )
        : null,
    requestedCurrencyId: requestedCurrency?.id ?? null,
  };
}

export class CreateDealCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
    private readonly idempotency: IdempotencyPort,
    private readonly references: DealReferencesPort,
  ) {}

  async execute(raw: CreateDealCommandInput): Promise<DealDetails> {
    const validated = CreateDealCommandInputSchema.parse(raw);
    const { agreement, calculation, requestedAmountMinor, requestedCurrencyId } =
      await validateDealReferences(validated, this.references);

    return this.commandUow.run((tx) =>
      this.idempotency.withIdempotencyTx({
        tx: tx.transaction,
        scope: DEALS_CREATE_IDEMPOTENCY_SCOPE,
        idempotencyKey: validated.idempotencyKey,
        request: {
          customerId: validated.customerId,
          agreementId: agreement.id,
          calculationId: validated.calculationId ?? null,
          type: validated.type,
          counterpartyId: validated.counterpartyId ?? null,
          agentId: validated.agentId ?? null,
          reason: validated.reason ?? null,
          intakeComment: validated.intakeComment ?? null,
          comment: validated.comment,
          requestedAmount: validated.requestedAmount ?? null,
          requestedCurrencyId: validated.requestedCurrencyId ?? null,
        },
        actorId: validated.actorUserId,
        serializeResult: (result) => ({ dealId: result.id }),
        loadReplayResult: async ({ storedResult }) => {
          const dealId = String(storedResult?.dealId ?? "");
          const replayed = await tx.dealReads.findById(dealId);

          if (!replayed) {
            throw new DealNotFoundError(dealId);
          }

          return replayed;
        },
        handler: async () => {
          const dealId = this.runtime.generateUuid();

          await tx.dealStore.createDealRoot({
            id: dealId,
            customerId: validated.customerId,
            agreementId: agreement.id,
            calculationId: validated.calculationId ?? null,
            type: validated.type,
            agentId: validated.agentId ?? null,
            reason: validated.reason ?? null,
            intakeComment: validated.intakeComment ?? null,
            comment: validated.comment,
            requestedAmountMinor,
            requestedCurrencyId,
          });

          if (calculation) {
            await tx.dealStore.createDealCalculationLinks([
              {
                id: this.runtime.generateUuid(),
                calculationId: calculation.id,
                dealId,
              },
            ]);
          }

          await tx.dealStore.createDealLegs([
            {
              id: this.runtime.generateUuid(),
              dealId,
              idx: 1,
              kind: "payment",
              status: "draft",
            },
          ]);

          await tx.dealStore.createDealParticipants([
            {
              id: this.runtime.generateUuid(),
              dealId,
              role: "customer",
              customerId: validated.customerId,
              organizationId: null,
              counterpartyId: null,
            },
            {
              id: this.runtime.generateUuid(),
              dealId,
              role: "organization",
              customerId: null,
              organizationId: agreement.organizationId,
              counterpartyId: null,
            },
            ...(validated.counterpartyId
              ? [
                  {
                    id: this.runtime.generateUuid(),
                    dealId,
                    role: "counterparty" as const,
                    customerId: null,
                    organizationId: null,
                    counterpartyId: validated.counterpartyId,
                  },
                ]
              : []),
          ]);

          await tx.dealStore.createDealStatusHistory([
            {
              id: this.runtime.generateUuid(),
              dealId,
              status: "draft",
              changedBy: validated.actorUserId,
              comment: validated.intakeComment ?? validated.comment,
            },
          ]);

          const created = await tx.dealReads.findById(dealId);

          if (!created) {
            throw new DealNotFoundError(dealId);
          }

          this.runtime.log.info("Deal created", {
            dealId,
            customerId: validated.customerId,
            agreementId: agreement.id,
            calculationId: validated.calculationId ?? null,
            type: validated.type,
          });

          return created;
        },
      }),
    );
  }
}
