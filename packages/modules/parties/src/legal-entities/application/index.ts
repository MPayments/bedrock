import type { ModuleRuntime } from "@bedrock/shared/core";

import { ReplaceLegalEntityAddressesCommand } from "./commands/replace-addresses";
import { ReplaceLegalEntityBundleCommand } from "./commands/replace-bundle";
import { ReplaceLegalEntityContactsCommand } from "./commands/replace-contacts";
import { ReplaceLegalEntityIdentifiersCommand } from "./commands/replace-identifiers";
import { ReplaceLegalEntityLicensesCommand } from "./commands/replace-licenses";
import { ReplaceLegalEntityRepresentativesCommand } from "./commands/replace-representatives";
import { UpsertLegalEntityProfileCommand } from "./commands/upsert-profile";
import type { LegalEntitiesReads } from "./ports/legal-entities.reads";
import type { LegalEntitiesCommandUnitOfWork } from "./ports/legal-entities.uow";
import { FindLegalEntityBundleByOwnerQuery } from "./queries/find-bundle-by-owner";
import { FindLegalEntityProfileByOwnerQuery } from "./queries/find-profile-by-owner";
import { ListLegalEntityAddressesByOwnerQuery } from "./queries/list-addresses-by-owner";
import { ListLegalEntityContactsByOwnerQuery } from "./queries/list-contacts-by-owner";
import { ListLegalEntityIdentifiersByOwnerQuery } from "./queries/list-identifiers-by-owner";
import { ListLegalEntityLicensesByOwnerQuery } from "./queries/list-licenses-by-owner";
import { ListLegalEntityRepresentativesByOwnerQuery } from "./queries/list-representatives-by-owner";

export interface LegalEntitiesServiceDeps {
  commandUow: LegalEntitiesCommandUnitOfWork;
  reads: LegalEntitiesReads;
  runtime: ModuleRuntime;
}

export function createLegalEntitiesService(deps: LegalEntitiesServiceDeps) {
  const upsertProfile = new UpsertLegalEntityProfileCommand(deps.commandUow);
  const replaceIdentifiers = new ReplaceLegalEntityIdentifiersCommand(
    deps.commandUow,
  );
  const replaceAddresses = new ReplaceLegalEntityAddressesCommand(
    deps.commandUow,
  );
  const replaceContacts = new ReplaceLegalEntityContactsCommand(
    deps.commandUow,
  );
  const replaceRepresentatives = new ReplaceLegalEntityRepresentativesCommand(
    deps.commandUow,
  );
  const replaceLicenses = new ReplaceLegalEntityLicensesCommand(deps.commandUow);
  const replaceBundle = new ReplaceLegalEntityBundleCommand(deps.commandUow);
  const findBundleByOwner = new FindLegalEntityBundleByOwnerQuery(deps.reads);
  const findProfileByOwner = new FindLegalEntityProfileByOwnerQuery(deps.reads);
  const listIdentifiersByOwner = new ListLegalEntityIdentifiersByOwnerQuery(
    deps.reads,
  );
  const listAddressesByOwner = new ListLegalEntityAddressesByOwnerQuery(
    deps.reads,
  );
  const listContactsByOwner = new ListLegalEntityContactsByOwnerQuery(
    deps.reads,
  );
  const listRepresentativesByOwner = new ListLegalEntityRepresentativesByOwnerQuery(
    deps.reads,
  );
  const listLicensesByOwner = new ListLegalEntityLicensesByOwnerQuery(
    deps.reads,
  );

  return {
    commands: {
      replaceBundle: replaceBundle.execute.bind(replaceBundle),
      upsertProfile: upsertProfile.execute.bind(upsertProfile),
      replaceIdentifiers: replaceIdentifiers.execute.bind(replaceIdentifiers),
      replaceAddresses: replaceAddresses.execute.bind(replaceAddresses),
      replaceContacts: replaceContacts.execute.bind(replaceContacts),
      replaceRepresentatives:
        replaceRepresentatives.execute.bind(replaceRepresentatives),
      replaceLicenses: replaceLicenses.execute.bind(replaceLicenses),
    },
    queries: {
      findBundleByOwner: findBundleByOwner.execute.bind(findBundleByOwner),
      findProfileByOwner: findProfileByOwner.execute.bind(findProfileByOwner),
      listIdentifiersByOwner:
        listIdentifiersByOwner.execute.bind(listIdentifiersByOwner),
      listAddressesByOwner:
        listAddressesByOwner.execute.bind(listAddressesByOwner),
      listContactsByOwner:
        listContactsByOwner.execute.bind(listContactsByOwner),
      listRepresentativesByOwner:
        listRepresentativesByOwner.execute.bind(listRepresentativesByOwner),
      listLicensesByOwner:
        listLicensesByOwner.execute.bind(listLicensesByOwner),
    },
  };
}

export type LegalEntitiesService = ReturnType<typeof createLegalEntitiesService>;
