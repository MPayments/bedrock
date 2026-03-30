import { toMinorAmountString } from "@bedrock/shared/money";
import type { ModuleRuntime } from "@bedrock/shared/core";
import { NotFoundError } from "@bedrock/shared/core/errors";
import { z } from "zod";

import {
  DealNotFoundError,
  DealRequestedAmountCurrencyMismatchError,
} from "../../errors";
import {
  UpdateDealIntakeInputSchema,
  type UpdateDealIntakeInput,
} from "../contracts/commands";
import type { DealDetails } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import type { DealReferencesPort } from "../ports/references.port";

const UpdateDealIntakeCommandInputSchema = UpdateDealIntakeInputSchema.extend({
  actorUserId: z.string().trim().min(1),
  dealId: z.uuid(),
});

type UpdateDealIntakeCommandInput = UpdateDealIntakeInput & {
  actorUserId: string;
  dealId: string;
};

export class UpdateDealIntakeCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
    private readonly references: DealReferencesPort,
  ) {}

  async execute(raw: UpdateDealIntakeCommandInput): Promise<DealDetails> {
    const validated = UpdateDealIntakeCommandInputSchema.parse(raw);

    if (
      ("requestedAmount" in validated) !== ("requestedCurrencyId" in validated)
    ) {
      throw new DealRequestedAmountCurrencyMismatchError();
    }

    const [counterparty, requestedCurrency] = await Promise.all([
      validated.counterpartyId
        ? this.references.findCounterpartyById(validated.counterpartyId)
        : Promise.resolve(validated.counterpartyId === null ? null : undefined),
      validated.requestedCurrencyId
        ? this.references.findCurrencyById(validated.requestedCurrencyId)
        : Promise.resolve(validated.requestedCurrencyId === null ? null : undefined),
    ]);

    if (validated.counterpartyId && !counterparty) {
      throw new NotFoundError("Counterparty", validated.counterpartyId);
    }

    if (validated.requestedCurrencyId && !requestedCurrency) {
      throw new NotFoundError("Currency", validated.requestedCurrencyId);
    }

    return this.commandUow.run(async (tx) => {
      const existing = await tx.dealReads.findById(validated.dealId);
      if (!existing) {
        throw new DealNotFoundError(validated.dealId);
      }

      await tx.dealStore.updateDealRoot({
        dealId: validated.dealId,
        ...(validated.agentId !== undefined
          ? { agentId: validated.agentId ?? null }
          : {}),
        ...(validated.comment !== undefined
          ? { comment: validated.comment ?? null }
          : {}),
        ...(validated.intakeComment !== undefined
          ? { intakeComment: validated.intakeComment ?? null }
          : {}),
        ...(validated.reason !== undefined
          ? { reason: validated.reason ?? null }
          : {}),
        ...(validated.requestedAmount !== undefined
          ? {
              requestedAmountMinor:
                validated.requestedAmount && requestedCurrency
                  ? BigInt(
                      toMinorAmountString(
                        validated.requestedAmount,
                        requestedCurrency.code,
                      ),
                    )
                  : null,
              requestedCurrencyId: requestedCurrency?.id ?? null,
            }
          : {}),
      });

      if (validated.counterpartyId !== undefined) {
        await tx.dealStore.setCounterpartyParticipant({
          dealId: validated.dealId,
          counterpartyId: validated.counterpartyId ?? null,
          id: validated.counterpartyId ? this.runtime.generateUuid() : undefined,
        });
      }

      const updated = await tx.dealReads.findById(validated.dealId);
      if (!updated) {
        throw new DealNotFoundError(validated.dealId);
      }

      return updated;
    });
  }
}
