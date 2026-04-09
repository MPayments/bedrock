import type { ModuleRuntime } from "@bedrock/shared/core";

import { ReplacePartyProfileAddressCommand } from "./commands/replace-addresses";
import { ReplacePartyProfileBundleCommand } from "./commands/replace-bundle";
import { ReplacePartyProfileContactsCommand } from "./commands/replace-contacts";
import { ReplacePartyProfileIdentifiersCommand } from "./commands/replace-identifiers";
import { ReplacePartyProfileLicensesCommand } from "./commands/replace-licenses";
import { ReplacePartyProfileRepresentativesCommand } from "./commands/replace-representatives";
import { UpsertPartyProfileCommand } from "./commands/upsert-profile";
import type { PartyProfilesReads } from "./ports/party-profiles.reads";
import type { PartyProfilesCommandUnitOfWork } from "./ports/party-profiles.uow";
import { FindPartyProfileBundleByOwnerQuery } from "./queries/find-bundle-by-owner";
import { FindPartyProfileByOwnerQuery } from "./queries/find-profile-by-owner";
import { FindPartyProfileAddressByOwnerQuery } from "./queries/list-addresses-by-owner";
import { ListPartyProfileContactsByOwnerQuery } from "./queries/list-contacts-by-owner";
import { ListPartyProfileIdentifiersByOwnerQuery } from "./queries/list-identifiers-by-owner";
import { ListPartyProfileLicensesByOwnerQuery } from "./queries/list-licenses-by-owner";
import { ListPartyProfileRepresentativesByOwnerQuery } from "./queries/list-representatives-by-owner";

export interface PartyProfilesServiceDeps {
  commandUow: PartyProfilesCommandUnitOfWork;
  reads: PartyProfilesReads;
  runtime: ModuleRuntime;
}

export function createPartyProfilesService(deps: PartyProfilesServiceDeps) {
  const upsertProfile = new UpsertPartyProfileCommand(deps.commandUow);
  const replaceIdentifiers = new ReplacePartyProfileIdentifiersCommand(
    deps.commandUow,
  );
  const replaceAddress = new ReplacePartyProfileAddressCommand(
    deps.commandUow,
  );
  const replaceContacts = new ReplacePartyProfileContactsCommand(
    deps.commandUow,
  );
  const replaceRepresentatives = new ReplacePartyProfileRepresentativesCommand(
    deps.commandUow,
  );
  const replaceLicenses = new ReplacePartyProfileLicensesCommand(deps.commandUow);
  const replaceBundle = new ReplacePartyProfileBundleCommand(deps.commandUow);
  const findBundleByOwner = new FindPartyProfileBundleByOwnerQuery(deps.reads);
  const findProfileByOwner = new FindPartyProfileByOwnerQuery(deps.reads);
  const listIdentifiersByOwner = new ListPartyProfileIdentifiersByOwnerQuery(
    deps.reads,
  );
  const findAddressByOwner = new FindPartyProfileAddressByOwnerQuery(
    deps.reads,
  );
  const listContactsByOwner = new ListPartyProfileContactsByOwnerQuery(
    deps.reads,
  );
  const listRepresentativesByOwner = new ListPartyProfileRepresentativesByOwnerQuery(
    deps.reads,
  );
  const listLicensesByOwner = new ListPartyProfileLicensesByOwnerQuery(
    deps.reads,
  );

  return {
    commands: {
      replaceBundle: replaceBundle.execute.bind(replaceBundle),
      upsertProfile: upsertProfile.execute.bind(upsertProfile),
      replaceIdentifiers: replaceIdentifiers.execute.bind(replaceIdentifiers),
      replaceAddress: replaceAddress.execute.bind(replaceAddress),
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
      findAddressByOwner: findAddressByOwner.execute.bind(findAddressByOwner),
      listContactsByOwner:
        listContactsByOwner.execute.bind(listContactsByOwner),
      listRepresentativesByOwner:
        listRepresentativesByOwner.execute.bind(listRepresentativesByOwner),
      listLicensesByOwner:
        listLicensesByOwner.execute.bind(listLicensesByOwner),
    },
  };
}

export type PartyProfilesService = ReturnType<typeof createPartyProfilesService>;
