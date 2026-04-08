import type { ModuleRuntime } from "@bedrock/shared/core";

import { CounterpartyNotFoundError } from "../../../counterparties/application/errors";
import type { CounterpartyReads } from "../../../counterparties/application/ports/counterparty.reads";
import { OrganizationNotFoundError } from "../../../organizations/application/errors";
import type { OrganizationReads } from "../../../organizations/application/ports/organization.reads";
import { validatePaymentIdentifiers } from "../../domain/identifier-schemes";
import { RequisiteOwner } from "../../domain/owner";
import {
  CreateRequisiteInputSchema,
  type CreateRequisiteInput,
} from "../contracts/requisites";
import type { RequisitesCurrenciesPort } from "../ports/currencies.port";
import type { RequisiteProviderReads } from "../ports/requisite-provider.reads";
import type { RequisitesCommandUnitOfWork } from "../ports/requisites.uow";
import { assertRequisiteProviderSelection } from "./assert-requisite-provider-selection";

async function assertOwnerExists(input: {
  owner: RequisiteOwner;
  organizationReads: OrganizationReads;
  counterpartyReads: CounterpartyReads;
}) {
  if (input.owner.isOrganization()) {
    const organization = await input.organizationReads.findById(input.owner.id);
    if (!organization) {
      throw new OrganizationNotFoundError(input.owner.id);
    }
    return;
  }

  const counterparty = await input.counterpartyReads.findById(input.owner.id);
  if (!counterparty) {
    throw new CounterpartyNotFoundError(input.owner.id);
  }
}

export class CreateRequisiteCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly currencies: RequisitesCurrenciesPort,
    private readonly organizationReads: OrganizationReads,
    private readonly counterpartyReads: CounterpartyReads,
    private readonly providerReads: RequisiteProviderReads,
    private readonly uow: RequisitesCommandUnitOfWork,
  ) {}

  async execute(input: CreateRequisiteInput) {
    const validated = CreateRequisiteInputSchema.parse(input);
    validatePaymentIdentifiers({
      owner: "requisite",
      identifiers: validated.identifiers,
      requisiteKind: validated.kind,
    });
    const owner = RequisiteOwner.create({
      type: validated.ownerType,
      id: validated.ownerId,
    });

    await assertOwnerExists({
      owner,
      organizationReads: this.organizationReads,
      counterpartyReads: this.counterpartyReads,
    });
    await this.currencies.assertCurrencyExists(validated.currencyId);
    await assertRequisiteProviderSelection(
      this.providerReads,
      validated.providerId,
      validated.providerBranchId,
    );

    return this.uow.run(async (tx) => {
      const set = await tx.requisites.findSetByOwnerCurrency({
        ownerType: owner.type,
        ownerId: owner.id,
        currencyId: validated.currencyId,
      });
      const { requisite: created, set: nextSet } = set.createRequisite(
        {
          id: this.runtime.generateUuid(),
          providerId: validated.providerId,
          providerBranchId: validated.providerBranchId,
          kind: validated.kind,
          label: validated.label,
          beneficiaryName: validated.beneficiaryName,
          beneficiaryNameLocal: validated.beneficiaryNameLocal,
          beneficiaryAddress: validated.beneficiaryAddress,
          paymentPurposeTemplate: validated.paymentPurposeTemplate,
          notes: validated.notes,
          requestedIsDefault: validated.isDefault,
        },
        this.runtime.now(),
      );

      await tx.requisites.saveSet(nextSet);
      const createdSnapshot = created.toSnapshot();
      await tx.requisites.replaceIdentifiers({
        requisiteId: createdSnapshot.id,
        items: validated.identifiers,
      });
      const requisite = await tx.requisites.findDetailById(createdSnapshot.id);

      if (!requisite) {
        throw new Error(`Requisite not found after create: ${createdSnapshot.id}`);
      }

      this.runtime.log.info("Requisite created", {
        id: requisite.id,
        ownerType: owner.type,
        ownerId: owner.id,
      });

      return requisite;
    });
  }
}
