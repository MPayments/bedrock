import type { TreasuryCoreServiceContext } from "../../../shared/application/core-context";
import { toTreasuryEndpointDto } from "../../../shared/application/mappers";
import { TreasuryEntityNotFoundError } from "../../../errors";
import {
  CreateTreasuryEndpointInputSchema,
  type CreateTreasuryEndpointInput,
} from "../../contracts";
import { assertTreasuryEndpointValid } from "../../domain/treasury-account";

export class CreateTreasuryEndpointCommand {
  constructor(private readonly context: TreasuryCoreServiceContext) {}

  async execute(input: CreateTreasuryEndpointInput) {
    const validated = CreateTreasuryEndpointInputSchema.parse(input);
    assertTreasuryEndpointValid(validated);

    const account = await this.context.reads.findTreasuryAccount(
      validated.accountId,
    );
    if (!account) {
      throw new TreasuryEntityNotFoundError(
        "TreasuryAccount",
        validated.accountId,
      );
    }

    const record = await this.context.unitOfWork.run((tx) =>
      tx.insertTreasuryEndpoint({
        id: this.context.runtime.generateUuid(),
        accountId: validated.accountId,
        endpointType: validated.endpointType,
        value: validated.value,
        label: validated.label ?? null,
        memoTag: validated.memoTag ?? null,
        metadata: validated.metadata ?? null,
        archivedAt: null,
      }),
    );

    return toTreasuryEndpointDto(record);
  }
}
