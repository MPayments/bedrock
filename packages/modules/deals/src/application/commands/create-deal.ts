import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { ModuleRuntime } from "@bedrock/shared/core";
import { NotFoundError } from "@bedrock/shared/core/errors";
import { z } from "zod";

import { DEALS_CREATE_IDEMPOTENCY_SCOPE } from "../../domain/constants";
import {
  DealAgreementCustomerMismatchError,
  DealAgreementInactiveError,
  DealCalculationInactiveError,
  DealNotFoundError,
} from "../../errors";
import {
  CreateDealInputSchema,
  type CreateDealInput,
} from "../contracts/commands";
import type { DealDetails } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import type { DealReferencesPort } from "../ports/references.port";

const CreateDealCommandInputSchema = CreateDealInputSchema.extend({
  actorUserId: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1).max(255),
});

type CreateDealCommandInput = CreateDealInput & {
  actorUserId: string;
  idempotencyKey: string;
};

async function validateDealReferences(
  input: CreateDealCommandInput,
  references: DealReferencesPort,
) {
  references.validateSupportedCreateType(input.type);

  const [customer, agreement, calculation, counterparty] = await Promise.all([
    references.findCustomerById(input.customerId),
    references.findAgreementById(input.agreementId),
    references.findCalculationById(input.calculationId),
    input.counterpartyId
      ? references.findCounterpartyById(input.counterpartyId)
      : Promise.resolve(null),
  ]);

  if (!customer) {
    throw new NotFoundError("Customer", input.customerId);
  }

  if (!agreement) {
    throw new NotFoundError("Agreement", input.agreementId);
  }

  if (!agreement.isActive) {
    throw new DealAgreementInactiveError(input.agreementId);
  }

  if (agreement.customerId !== input.customerId) {
    throw new DealAgreementCustomerMismatchError(
      input.agreementId,
      input.customerId,
    );
  }

  if (!calculation) {
    throw new NotFoundError("Calculation", input.calculationId);
  }

  if (!calculation.isActive) {
    throw new DealCalculationInactiveError(input.calculationId);
  }

  if (input.counterpartyId && !counterparty) {
    throw new NotFoundError("Counterparty", input.counterpartyId);
  }

  return { agreement };
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
    const { agreement } = await validateDealReferences(
      validated,
      this.references,
    );

    return this.commandUow.run((tx) =>
      this.idempotency.withIdempotencyTx({
        tx: tx.transaction,
        scope: DEALS_CREATE_IDEMPOTENCY_SCOPE,
        idempotencyKey: validated.idempotencyKey,
        request: {
          customerId: validated.customerId,
          agreementId: validated.agreementId,
          calculationId: validated.calculationId,
          type: validated.type,
          counterpartyId: validated.counterpartyId ?? null,
          comment: validated.comment,
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
            agreementId: validated.agreementId,
            calculationId: validated.calculationId,
            type: validated.type,
            comment: validated.comment,
          });

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
              comment: validated.comment,
            },
          ]);

          const created = await tx.dealReads.findById(dealId);

          if (!created) {
            throw new DealNotFoundError(dealId);
          }

          this.runtime.log.info("Deal created", {
            dealId,
            customerId: validated.customerId,
            agreementId: validated.agreementId,
            calculationId: validated.calculationId,
            type: validated.type,
          });

          return created;
        },
      }),
    );
  }
}
