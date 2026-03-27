import type { TreasuryCoreServiceContext } from "../../../shared/application/core-context";
import { toTreasuryOperationDto } from "../../../shared/application/mappers";

export class FindOperationByIdempotencyKeyQuery {
  constructor(private readonly context: TreasuryCoreServiceContext) {}

  async execute(idempotencyKey: string) {
    const record = await this.context.reads.findOperationByIdempotencyKey(
      idempotencyKey,
    );

    return record ? toTreasuryOperationDto(record) : null;
  }
}
