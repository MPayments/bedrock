import type { TreasuryCoreServiceContext } from "../../../shared/application/core-context";
import { toObligationDto } from "../../../shared/application/mappers";
import { OpenObligationInputSchema, type OpenObligationInput } from "../../contracts";
import { assertObligationValid } from "../../domain/obligation";

export class OpenObligationCommand {
  constructor(private readonly context: TreasuryCoreServiceContext) {}

  async execute(input: OpenObligationInput) {
    const validated = OpenObligationInputSchema.parse(input);
    const amountMinor = BigInt(validated.amountMinor);

    assertObligationValid({
      debtorEntityId: validated.debtorEntityId,
      creditorEntityId: validated.creditorEntityId,
      assetId: validated.assetId,
      amountMinor,
    });

    const record = await this.context.unitOfWork.run((tx) =>
      tx.insertObligation({
        id: this.context.runtime.generateUuid(),
        obligationKind: validated.obligationKind,
        debtorEntityId: validated.debtorEntityId,
        creditorEntityId: validated.creditorEntityId,
        beneficialOwnerType: validated.beneficialOwnerType ?? null,
        beneficialOwnerId: validated.beneficialOwnerId ?? null,
        assetId: validated.assetId,
        amountMinor,
        dueAt: validated.dueAt ?? null,
        memo: validated.memo ?? null,
        payload: validated.payload ?? null,
      }),
    );

    return toObligationDto(record);
  }
}
