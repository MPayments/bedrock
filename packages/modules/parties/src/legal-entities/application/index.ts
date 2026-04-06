import type { ModuleRuntime } from "@bedrock/shared/core";
import { ValidationError } from "@bedrock/shared/core/errors";

import type {
  PartyAddressInput,
  PartyContactInput,
  PartyLegalIdentifierInput,
  PartyLegalOwnerType,
  PartyLegalProfileInput,
  PartyLicenseInput,
  PartyRepresentativeInput,
} from "./contracts";
import type { LegalEntitiesReads } from "./ports/legal-entities.reads";
import type { LegalEntitiesCommandUnitOfWork } from "./ports/legal-entities.uow";

function assertSinglePrimary<T extends { isPrimary: boolean }>(
  items: readonly T[],
  discriminator: (item: T) => string,
  field: string,
) {
  const primaryCounts = new Map<string, number>();

  for (const item of items) {
    if (!item.isPrimary) {
      continue;
    }

    const key = discriminator(item);
    primaryCounts.set(key, (primaryCounts.get(key) ?? 0) + 1);
  }

  for (const [key, count] of primaryCounts) {
    if (count > 1) {
      throw new ValidationError(
        `Only one primary ${field} is allowed for ${key}`,
      );
    }
  }
}

function validateIdentifierInputs(items: readonly PartyLegalIdentifierInput[]) {
  assertSinglePrimary(items, (item) => item.scheme, "identifier");
}

function validateAddressInputs(items: readonly PartyAddressInput[]) {
  assertSinglePrimary(items, (item) => item.type, "address");
}

function validateContactInputs(items: readonly PartyContactInput[]) {
  assertSinglePrimary(items, (item) => item.type, "contact");
}

function validateRepresentativeInputs(items: readonly PartyRepresentativeInput[]) {
  assertSinglePrimary(items, (item) => item.role, "representative");
}

export interface LegalEntitiesServiceDeps {
  commandUow: LegalEntitiesCommandUnitOfWork;
  reads: LegalEntitiesReads;
  runtime: ModuleRuntime;
}

export function createLegalEntitiesService(deps: LegalEntitiesServiceDeps) {
  async function upsertProfile(input: {
    ownerType: PartyLegalOwnerType;
    ownerId: string;
    profile: PartyLegalProfileInput;
  }) {
    return deps.commandUow.run((tx) =>
      tx.legalEntities.upsertProfile(input),
    );
  }

  async function replaceIdentifiers(input: {
    ownerType: PartyLegalOwnerType;
    ownerId: string;
    items: PartyLegalIdentifierInput[];
  }) {
    validateIdentifierInputs(input.items);
    return deps.commandUow.run((tx) =>
      tx.legalEntities.replaceIdentifiers(input),
    );
  }

  async function replaceAddresses(input: {
    ownerType: PartyLegalOwnerType;
    ownerId: string;
    items: PartyAddressInput[];
  }) {
    validateAddressInputs(input.items);
    return deps.commandUow.run((tx) => tx.legalEntities.replaceAddresses(input));
  }

  async function replaceContacts(input: {
    ownerType: PartyLegalOwnerType;
    ownerId: string;
    items: PartyContactInput[];
  }) {
    validateContactInputs(input.items);
    return deps.commandUow.run((tx) => tx.legalEntities.replaceContacts(input));
  }

  async function replaceRepresentatives(input: {
    ownerType: PartyLegalOwnerType;
    ownerId: string;
    items: PartyRepresentativeInput[];
  }) {
    validateRepresentativeInputs(input.items);
    return deps.commandUow.run((tx) =>
      tx.legalEntities.replaceRepresentatives(input),
    );
  }

  async function replaceLicenses(input: {
    ownerType: PartyLegalOwnerType;
    ownerId: string;
    items: PartyLicenseInput[];
  }) {
    return deps.commandUow.run((tx) => tx.legalEntities.replaceLicenses(input));
  }

  return {
    commands: {
      upsertProfile,
      replaceIdentifiers,
      replaceAddresses,
      replaceContacts,
      replaceRepresentatives,
      replaceLicenses,
    },
    queries: {
      findBundleByOwner: deps.reads.findBundleByOwner.bind(deps.reads),
      findProfileByOwner: deps.reads.findProfileByOwner.bind(deps.reads),
      listIdentifiersByOwner: deps.reads.listIdentifiersByOwner.bind(deps.reads),
      listAddressesByOwner: deps.reads.listAddressesByOwner.bind(deps.reads),
      listContactsByOwner: deps.reads.listContactsByOwner.bind(deps.reads),
      listRepresentativesByOwner:
        deps.reads.listRepresentativesByOwner.bind(deps.reads),
      listLicensesByOwner: deps.reads.listLicensesByOwner.bind(deps.reads),
    },
  };
}

export type LegalEntitiesService = ReturnType<typeof createLegalEntitiesService>;

