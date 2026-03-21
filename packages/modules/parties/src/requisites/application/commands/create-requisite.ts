import type { ModuleRuntime } from "@bedrock/shared/core";

import { CounterpartyNotFoundError } from "../../../counterparties/application/errors";
import type { CounterpartyReads } from "../../../counterparties/application/ports/counterparty.reads";
import { OrganizationNotFoundError } from "../../../organizations/application/errors";
import type { OrganizationReads } from "../../../organizations/application/ports/organization.reads";
import { RequisiteOwner } from "../../domain/owner";
import {
  CreateRequisiteInputSchema,
  type CreateRequisiteInput,
} from "../contracts/requisites";
import { RequisiteProviderNotActiveError } from "../errors";
import type { RequisitesCurrenciesPort } from "../ports/currencies.port";
import type { RequisiteProviderReads } from "../ports/requisite-provider.reads";
import type { RequisitesCommandUnitOfWork } from "../ports/requisites.uow";

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

async function assertProviderActive(
  reads: RequisiteProviderReads,
  providerId: string,
) {
  const provider = await reads.findActiveById(providerId);

  if (!provider) {
    throw new RequisiteProviderNotActiveError(providerId);
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
    await assertProviderActive(this.providerReads, validated.providerId);

    return this.uow.run(async (tx) => {
      const set = await tx.requisites.findSetByOwnerCurrency({
        ownerType: owner.type,
        ownerId: owner.id,
        currencyId: validated.currencyId,
      });
      const { requisite: created, set: nextSet } = set.createRequisite(
        {
          ...validated,
          id: this.runtime.generateUuid(),
          requestedIsDefault: validated.isDefault,
        },
        this.runtime.now(),
      );

      await tx.requisites.saveSet(nextSet);
      const createdSnapshot = created.toSnapshot();

      this.runtime.log.info("Requisite created", {
        id: createdSnapshot.id,
        ownerType: owner.type,
        ownerId: owner.id,
      });

      return createdSnapshot;
    });
  }
}
