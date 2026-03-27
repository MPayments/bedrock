import type { TreasuryCoreServiceContext } from "../../../shared/application/core-context";
import { toTreasuryAccountDto } from "../../../shared/application/mappers";
import {
  CreateTreasuryAccountInputSchema,
  type CreateTreasuryAccountInput,
} from "../../contracts";
import { assertTreasuryAccountValid } from "../../domain/treasury-account";

export class CreateTreasuryAccountCommand {
  constructor(private readonly context: TreasuryCoreServiceContext) {}

  async execute(input: CreateTreasuryAccountInput) {
    const validated = CreateTreasuryAccountInputSchema.parse(input);
    assertTreasuryAccountValid(validated);

    const record = await this.context.unitOfWork.run((tx) =>
      tx.insertTreasuryAccount({
        id: this.context.runtime.generateUuid(),
        kind: validated.kind,
        ownerEntityId: validated.ownerEntityId,
        operatorEntityId: validated.operatorEntityId,
        assetId: validated.assetId,
        provider: validated.provider ?? null,
        networkOrRail: validated.networkOrRail ?? null,
        accountReference: validated.accountReference,
        reconciliationMode: validated.reconciliationMode ?? null,
        finalityModel: validated.finalityModel ?? null,
        segregationModel: validated.segregationModel ?? null,
        canReceive: validated.canReceive,
        canSend: validated.canSend,
        metadata: validated.metadata ?? null,
        archivedAt: null,
      }),
    );

    return toTreasuryAccountDto(record);
  }
}
