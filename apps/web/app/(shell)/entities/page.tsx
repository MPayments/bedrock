import { BookOpen } from "lucide-react";

import { getCounterparties } from "@/features/entities/counterparties/lib/queries";
import { getCounterpartyRequisites } from "@/features/entities/counterparty-requisites/lib/queries";
import { getCurrencies } from "@/features/entities/currencies/lib/queries";
import { getCustomers } from "@/features/entities/customers/lib/queries";
import { getOrganizationRequisites } from "@/features/entities/organization-requisites/lib/queries";
import { SectionOverviewPage } from "@/features/overview/ui/section-overview-page";

function formatCount(value: number) {
  return value.toLocaleString("ru-RU");
}

export default async function EntitiesOverviewPage() {
  const [
    customers,
    counterparties,
    counterpartyRequisites,
    organizationRequisites,
    currencies,
  ] =
    await Promise.all([
      getCustomers({ page: 1, perPage: 1 }),
      getCounterparties({ page: 1, perPage: 1 }),
      getCounterpartyRequisites({ page: 1, perPage: 1 }),
      getOrganizationRequisites({ page: 1, perPage: 1 }),
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
          id: "counterparties",
          label: "Контрагенты",
          value: formatCount(counterparties.total),
          description: "Внешние стороны и группировки для расчетов и аналитики.",
          href: "/entities/counterparties",
        },
        {
          id: "counterparty-requisites",
          label: "Реквизиты контрагентов",
          value: formatCount(counterpartyRequisites.total),
          description: "Внешние реквизиты без бухгалтерской привязки.",
          href: "/entities/counterparty-requisites",
        },
        {
          id: "organization-requisites",
          label: "Реквизиты организаций",
          value: formatCount(organizationRequisites.total),
          description: "Внутренние расчётные реквизиты организаций.",
          href: "/entities/organization-requisites",
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
          description: "Группы, профили и связанные счета/операции.",
          href: "/entities/counterparties",
        },
        {
          id: "counterparty-requisites",
          title: "Реквизиты контрагентов",
          description: "Каталог пользовательских реквизитов для внешних контрагентов.",
          href: "/entities/counterparty-requisites",
          cta: "Открыть реквизиты",
        },
        {
          id: "organization-requisites",
          title: "Реквизиты организаций",
          description: "Внутренние реквизиты своих компаний с отдельной accounting binding.",
          href: "/entities/organization-requisites",
          cta: "Открыть реквизиты",
        },
      ]}
    />
  );
}
