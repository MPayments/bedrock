import { invariant } from "@bedrock/shared/core/domain";

import type { TreasuryCoreServiceContext } from "../../../shared/application/core-context";
import { toExecutionInstructionDto } from "../../../shared/application/mappers";
import { TreasuryEntityNotFoundError } from "../../../errors";
import {
  CreateExecutionInstructionInputSchema,
  type CreateExecutionInstructionInput,
} from "../../contracts";
import { assertOperationSupportsInstructionCreation } from "../../../operations/domain/treasury-operation";

export class CreateExecutionInstructionCommand {
  constructor(private readonly context: TreasuryCoreServiceContext) {}

  async execute(input: CreateExecutionInstructionInput) {
    const validated = CreateExecutionInstructionInputSchema.parse(input);
    const operation = await this.context.reads.findOperation(validated.operationId);
    if (!operation) {
      throw new TreasuryEntityNotFoundError("Operation", validated.operationId);
    }

    assertOperationSupportsInstructionCreation(operation);

    const sourceAccountId = validated.sourceAccountId ?? operation.sourceAccountId;
    const assetId = validated.assetId ?? operation.sourceAssetId;
    const amountMinor = validated.amountMinor
      ? BigInt(validated.amountMinor)
      : operation.sourceAmountMinor;

    invariant(sourceAccountId, "sourceAccountId is required", {
      code: "treasury.execution_instruction.source_account_required",
    });
    invariant(assetId, "assetId is required", {
      code: "treasury.execution_instruction.asset_required",
    });
    invariant(amountMinor && amountMinor > 0n, "amountMinor must be positive", {
      code: "treasury.execution_instruction.amount_positive",
    });

    const sourceAccount = await this.context.reads.findTreasuryAccount(sourceAccountId);
    if (!sourceAccount) {
      throw new TreasuryEntityNotFoundError("TreasuryAccount", sourceAccountId);
    }

    if (validated.destinationEndpointId) {
      const endpoint =
        (await this.context.reads.findCounterpartyEndpoint(
          validated.destinationEndpointId,
        )) ??
        (await this.context.reads.findTreasuryEndpoint(
          validated.destinationEndpointId,
        ));

      if (!endpoint) {
        throw new TreasuryEntityNotFoundError(
          "Endpoint",
          validated.destinationEndpointId,
        );
      }
    }

    const instruction = await this.context.unitOfWork.run((tx) =>
      tx.insertExecutionInstruction({
        id: this.context.runtime.generateUuid(),
        operationId: operation.id,
        sourceAccountId,
        destinationEndpointId: validated.destinationEndpointId ?? null,
        submissionChannel: validated.submissionChannel,
        instructionStatus: operation.instructionStatus,
        assetId,
        amountMinor,
        metadata: validated.metadata ?? null,
      }),
    );

    return toExecutionInstructionDto(instruction);
  }
}
