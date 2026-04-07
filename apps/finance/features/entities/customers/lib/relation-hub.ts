import { cache } from "react";

import { getCounterparties } from "@/features/entities/counterparties/lib/queries";
import { getCounterpartyRequisitesForCounterparty } from "@/features/entities/counterparty-requisites/lib/queries";

export type CustomerRelationHubData = {
  counterparties: Array<{
    id: string;
    shortName: string;
    fullName: string;
    country: string | null;
    kind: "legal_entity" | "individual";
    openHref: string;
    createRequisiteHref: string;
    requisites: Array<{
      id: string;
      label: string;
      identity: string;
      currencyLabel: string;
      isDefault: boolean;
      openHref: string;
    }>;
  }>;
  createCounterpartyHref: string;
};

const getCustomerRelationHubDataUncached = async (
  customerId: string,
): Promise<CustomerRelationHubData> => {
  const counterpartiesResult = await getCounterparties({
    customerId,
    limit: 100,
    offset: 0,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const counterparties = await Promise.all(
    counterpartiesResult.data.map(async (counterparty) => {
      const requisites = await getCounterpartyRequisitesForCounterparty(
        counterparty.id,
      );

      return {
        id: counterparty.id,
        shortName: counterparty.shortName,
        fullName: counterparty.fullName,
        country: counterparty.country,
        kind: counterparty.kind,
        openHref: `/entities/counterparties/${counterparty.id}`,
        createRequisiteHref: `/entities/requisites/create?ownerType=counterparty&ownerId=${counterparty.id}`,
        requisites: requisites.map((requisite) => ({
          id: requisite.id,
          label: requisite.label,
          identity: requisite.identity,
          currencyLabel: requisite.currencyDisplay,
          isDefault: requisite.isDefault,
          openHref: `/entities/requisites/${requisite.id}`,
        })),
      };
    }),
  );

  return {
    counterparties,
    createCounterpartyHref: `/entities/counterparties/create?customerId=${customerId}`,
  };
};

export const getCustomerRelationHubData = cache(
  getCustomerRelationHubDataUncached,
);
