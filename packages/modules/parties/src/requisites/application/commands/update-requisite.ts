import type { ModuleRuntime } from "@bedrock/shared/core";
import { applyPatch } from "@bedrock/shared/core";

import { assertRequisiteProviderSelection } from "./assert-requisite-provider-selection";
import { validatePaymentIdentifiers } from "../../domain/identifier-schemes";
import type { UpdateRequisiteProps } from "../../domain/requisite";
import {
  UpdateRequisiteInputSchema,
  type UpdateRequisiteInput,
} from "../contracts/requisites";
import {
  RequisiteNotFoundError,
} from "../errors";
import type { RequisitesCurrenciesPort } from "../ports/currencies.port";
import type { RequisiteProviderReads } from "../ports/requisite-provider.reads";
import type { RequisitesCommandUnitOfWork } from "../ports/requisites.uow";

export class UpdateRequisiteCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly currencies: RequisitesCurrenciesPort,
    private readonly providerReads: RequisiteProviderReads,
    private readonly uow: RequisitesCommandUnitOfWork,
  ) {}

  async execute(id: string, input: UpdateRequisiteInput) {
    const validated = UpdateRequisiteInputSchema.parse(input);

    return this.uow.run(async (tx) => {
      const now = this.runtime.now();
      const existing = await tx.requisites.findById(id);
      if (!existing) {
        throw new RequisiteNotFoundError(id);
      }

      const current = existing.toSnapshot();
      const nextInput = applyPatch<UpdateRequisiteProps>(
        {
          providerId: current.providerId,
          providerBranchId: current.providerBranchId,
          currencyId: current.currencyId,
          kind: current.kind,
          label: current.label,
          beneficiaryName: current.beneficiaryName,
          beneficiaryNameLocal: current.beneficiaryNameLocal,
          beneficiaryAddress: current.beneficiaryAddress,
          paymentPurposeTemplate: current.paymentPurposeTemplate,
          notes: current.notes,
          isDefault: current.isDefault,
        },
        validated,
      );
      const currencyChanged = nextInput.currencyId !== current.currencyId;

      await this.currencies.assertCurrencyExists(nextInput.currencyId);
      await assertRequisiteProviderSelection(
        this.providerReads,
        nextInput.providerId,
        nextInput.providerBranchId,
      );
      let identifiersToValidate = validated.identifiers;
      if (
        identifiersToValidate === undefined &&
        nextInput.kind !== current.kind
      ) {
        const detail = await tx.requisites.findDetailById(id);

        if (!detail) {
          throw new RequisiteNotFoundError(id);
        }

        identifiersToValidate = detail.identifiers.map((identifier) => ({
          id: identifier.id,
          scheme: identifier.scheme,
          value: identifier.value,
          isPrimary: identifier.isPrimary,
        }));
      }
      if (identifiersToValidate !== undefined) {
        validatePaymentIdentifiers({
          owner: "requisite",
          identifiers: identifiersToValidate,
          requisiteKind: nextInput.kind,
        });
      }

      const sourceSet = await tx.requisites.findSetByOwnerCurrency({
        ownerType: current.ownerType,
        ownerId: current.ownerId,
        currencyId: current.currencyId,
      });
      let updated;

      if (currencyChanged) {
        const targetSet = await tx.requisites.findSetByOwnerCurrency({
          ownerType: current.ownerType,
          ownerId: current.ownerId,
          currencyId: nextInput.currencyId,
        });
        const detached = sourceSet.detachRequisite(id, now);
        const attached = targetSet.attachTransferredRequisite(
          detached.requisite,
          nextInput,
          now,
        );

        await tx.requisites.saveSet(detached.set);
        await tx.requisites.saveSet(attached.set);
        updated = attached.requisite;
      } else {
        const next = sourceSet.updateRequisite(id, nextInput, now);
        await tx.requisites.saveSet(next.set);
        updated = next.requisite;
      }

      if (validated.identifiers !== undefined) {
        await tx.requisites.replaceIdentifiers({
          requisiteId: updated.id,
          items: validated.identifiers,
        });
      }
      const requisite = await tx.requisites.findDetailById(updated.id);

      if (!requisite) {
        throw new Error(`Requisite not found after update: ${updated.id}`);
      }

      this.runtime.log.info("Requisite updated", {
        id,
        ownerType: current.ownerType,
        ownerId: current.ownerId,
      });

      return requisite;
    });
  }
}
