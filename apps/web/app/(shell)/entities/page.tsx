import { BookOpen } from "lucide-react";

import { getCounterparties } from "@/features/entities/counterparties/lib/queries";
import { getCurrencies } from "@/features/entities/currencies/lib/queries";
import { getCustomers } from "@/features/entities/customers/lib/queries";
import { getOrganizations } from "@/features/entities/organizations/lib/queries";
import { getRequisiteProviders } from "@/features/entities/requisite-providers/lib/queries";
import { getRequisites } from "@/features/entities/requisites/lib/queries";
import { SectionOverviewPage } from "@/features/overview/ui/section-overview-page";

function formatCount(value: number) {
  return value.toLocaleString("ru-RU");
}

export default async function EntitiesOverviewPage() {
  const [
    customers,
    organizations,
    counterparties,
    requisites,
    requisiteProviders,
    currencies,
  ] =
    await Promise.all([
      getCustomers({ page: 1, perPage: 1 }),
      getOrganizations(),
      getCounterparties({ page: 1, perPage: 1 }),
      getRequisites(),
      getRequisiteProviders(),
      getCurrencies({ page: 1, perPage: 1 }),
    ]);

  return (
    <SectionOverviewPage
      icon={BookOpen}
      title="Справочники"
      description="Каталог master-data модулей для клиентов, контрагентов, реквизитов и валют."
      stats={[
        {
          id: "customers",
          label: "Клиенты",
          value: formatCount(customers.total),
          description: "Организации и юридические сущности, владеющие потоками.",
          href: "/entities/customers",
        },
        {
          id: "organizations",
          label: "Организации",
          value: formatCount(organizations.total),
          description: "Собственные компании, владеющие книгами и расчетными позициями.",
          href: "/entities/organizations",
        },
        {
          id: "counterparties",
          label: "Контрагенты",
          value: formatCount(counterparties.total),
          description: "Внешние стороны и группировки для расчетов и аналитики.",
          href: "/entities/counterparties",
        },
        {
          id: "requisites",
          label: "Реквизиты",
          value: formatCount(requisites.total),
          description: "Единый каталог собственных и внешних реквизитов.",
          href: "/entities/requisites",
        },
        {
          id: "requisite-providers",
          label: "Провайдеры реквизитов",
          value: formatCount(requisiteProviders.total),
          description: "Банки, custodians, exchanges и blockchain-провайдеры.",
          href: "/entities/requisite-providers",
        },
        {
          id: "currencies",
          label: "Валюты",
          value: formatCount(currencies.total),
          description: "Справочник валют для FX и расчетов.",
          href: "/entities/currencies",
        },
      ]}
      links={[
        {
          id: "customers",
          title: "Клиенты",
          description: "CRUD для customer сущностей и связанных контрагентов.",
          href: "/entities/customers",
        },
        {
          id: "counterparties",
          title: "Контрагенты",
          description: "Внешние стороны, папки и профили для расчетов и аналитики.",
          href: "/entities/counterparties",
        },
        {
          id: "organizations",
          title: "Организации",
          description: "Отдельный master-справочник собственных компаний.",
          href: "/entities/organizations",
          cta: "Открыть организации",
        },
        {
          id: "requisites",
          title: "Реквизиты",
          description: "Единый каталог реквизитов организаций и контрагентов.",
          href: "/entities/requisites",
          cta: "Открыть реквизиты",
        },
        {
          id: "requisite-providers",
          title: "Провайдеры реквизитов",
          description: "Единый каталог банков, custodians, exchanges и blockchain-провайдеров.",
          href: "/entities/requisite-providers",
          cta: "Открыть провайдеров",
        },
      ]}
    />
  );
}
