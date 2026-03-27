import type { TreasuryCoreServiceContext } from "../../../shared/application/core-context";
import { toTreasuryOperationDto } from "../../../shared/application/mappers";
import {
  TreasuryEntityNotFoundError,
  TreasuryOperationIdempotencyConflictError,
} from "../../../errors";
import {
  IssueOperationInputSchema,
  type IssueOperationInput,
} from "../../contracts";
import {
  assertOperationRelatedStateValid,
  normalizeOperationRecord,
} from "../../domain/treasury-operation";

export class IssueOperationCommand {
  constructor(private readonly context: TreasuryCoreServiceContext) {}

  async execute(input: IssueOperationInput) {
    const validated = IssueOperationInputSchema.parse(input);
    const existing = await this.context.reads.findOperationByIdempotencyKey(
      validated.idempotencyKey,
    );

    if (existing) {
      throw new TreasuryOperationIdempotencyConflictError(
        validated.idempotencyKey,
      );
    }

    const operationRecord = normalizeOperationRecord(validated);
    let sourceAccountAssetId: string | null = null;
    let destinationAccountAssetId: string | null = null;

    if (operationRecord.sourceAccountId) {
      const sourceAccount = await this.context.reads.findTreasuryAccount(
        operationRecord.sourceAccountId,
      );
      if (!sourceAccount) {
        throw new TreasuryEntityNotFoundError(
          "TreasuryAccount",
          operationRecord.sourceAccountId,
        );
      }
      sourceAccountAssetId = sourceAccount.assetId;
    }

    if (operationRecord.destinationAccountId) {
      const destinationAccount = await this.context.reads.findTreasuryAccount(
        operationRecord.destinationAccountId,
      );
      if (!destinationAccount) {
        throw new TreasuryEntityNotFoundError(
          "TreasuryAccount",
          operationRecord.destinationAccountId,
        );
      }
      destinationAccountAssetId = destinationAccount.assetId;
    }

    const obligations = await Promise.all(
      (validated.obligationIds ?? []).map(async (obligationId) => {
        const obligation = await this.context.reads.findObligation(obligationId);

        if (!obligation) {
          throw new TreasuryEntityNotFoundError("Obligation", obligationId);
        }

        return obligation;
      }),
    );

    assertOperationRelatedStateValid({
      destinationAccountAssetId,
      obligationAssetIds: obligations.map((obligation) => obligation.assetId),
      operation: operationRecord,
      sourceAccountAssetId,
    });

    const operation = await this.context.unitOfWork.run(async (tx) => {
      const created = await tx.insertOperation({
        id: this.context.runtime.generateUuid(),
        ...operationRecord,
      });

      await tx.insertOperationObligationLinks(
        obligations.map((obligation) => ({
          operationId: created.id,
          obligationId: obligation.id,
        })),
      );

      return created;
    });

    return toTreasuryOperationDto(operation);
  }
}
