import { BookOpen } from "lucide-react";

import { getAccounts } from "@/features/entities/counterparty-accounts/lib/queries";
import { getCounterparties } from "@/features/entities/counterparties/lib/queries";
import { getCurrencies } from "@/features/entities/currencies/lib/queries";
import { getCustomers } from "@/features/entities/customers/lib/queries";
import { getProviders } from "@/features/entities/counterparty-account-providers/lib/queries";
import { SectionOverviewPage } from "@/features/overview/ui/section-overview-page";

function formatCount(value: number) {
  return value.toLocaleString("ru-RU");
}

export default async function EntitiesOverviewPage() {
  const [customers, counterparties, providers, accounts, currencies] =
    await Promise.all([
      getCustomers({ page: 1, perPage: 1 }),
      getCounterparties({ page: 1, perPage: 1 }),
      getProviders({ page: 1, perPage: 1 }),
      getAccounts({ page: 1, perPage: 1 }),
      getCurrencies({ page: 1, perPage: 1 }),
    ]);

  return (
    <SectionOverviewPage
      icon={BookOpen}
      title="Справочники"
      description="Каталог master-data модулей для клиентов, контрагентов, провайдеров, счетов и валют."
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
          id: "providers",
          label: "Провайдеры",
          value: formatCount(providers.total),
          description: "Расчетные методы и внешние account providers.",
          href: "/entities/counterparty-account-providers",
        },
        {
          id: "counterparty-accounts",
          label: "Счета",
          value: formatCount(accounts.total),
          description: "Операционные счета контрагентов у провайдеров.",
          href: "/entities/counterparty-accounts",
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
          id: "counterparty-accounts",
          title: "Счета и провайдеры",
          description: "Операционные счета и account providers в одной зоне.",
          href: "/entities/counterparty-accounts",
          cta: "Открыть счета",
        },
      ]}
    />
  );
}
