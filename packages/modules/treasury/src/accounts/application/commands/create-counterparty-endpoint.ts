import type { TreasuryCoreServiceContext } from "../../../shared/application/core-context";
import { toCounterpartyEndpointDto } from "../../../shared/application/mappers";
import {
  CreateCounterpartyEndpointInputSchema,
  type CreateCounterpartyEndpointInput,
} from "../../contracts";
import { assertCounterpartyEndpointValid } from "../../domain/treasury-account";

export class CreateCounterpartyEndpointCommand {
  constructor(private readonly context: TreasuryCoreServiceContext) {}

  async execute(input: CreateCounterpartyEndpointInput) {
    const validated = CreateCounterpartyEndpointInputSchema.parse(input);
    assertCounterpartyEndpointValid(validated);

    const record = await this.context.unitOfWork.run((tx) =>
      tx.insertCounterpartyEndpoint({
        id: this.context.runtime.generateUuid(),
        counterpartyId: validated.counterpartyId,
        assetId: validated.assetId,
        endpointType: validated.endpointType,
        value: validated.value,
        label: validated.label ?? null,
        memoTag: validated.memoTag ?? null,
        metadata: validated.metadata ?? null,
        archivedAt: null,
      }),
    );

    return toCounterpartyEndpointDto(record);
  }
}
