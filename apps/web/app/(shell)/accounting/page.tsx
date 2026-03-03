import { Calculator } from "lucide-react";

import {
  getAccountingCorrespondenceRules,
  getAccountingTemplateAccounts,
} from "@/features/accounting/lib/queries";
import { getOperations } from "@/features/operations/journal/lib/queries";
import { SectionOverviewPage } from "@/features/overview/ui/section-overview-page";

function formatCount(value: number) {
  return value.toLocaleString("ru-RU");
}

export default async function AccountingOverviewPage() {
  const [accounts, rules, operations] = await Promise.all([
    getAccountingTemplateAccounts(),
    getAccountingCorrespondenceRules(),
    getOperations({ page: 1, perPage: 1 }),
  ]);

  return (
    <SectionOverviewPage
      icon={Calculator}
      title="Бухгалтерия"
      description="Административная зона для плана счетов, корреспонденции, журнала операций и отчетности."
      stats={[
        {
          id: "counterparty-accounts",
          label: "План счетов",
          value: formatCount(accounts.length),
          description: "Глобальный chart template, доступный для posting rules.",
          href: "/accounting/accounts",
        },
        {
          id: "rules",
          label: "Правила корреспонденции",
          value: formatCount(rules.length),
          description: "Активные debit/credit соответствия для posting codes.",
          href: "/accounting/correspondence",
        },
        {
          id: "operations",
          label: "Ledger operations",
          value: formatCount(operations.total),
          description: "Операции бухгалтерского журнала с деталями postings и TB plans.",
          href: "/documents/journal",
        },
      ]}
      links={[
        {
          id: "counterparty-accounts",
          title: "План счетов",
          description: "Просмотр иерархии глобальных template accounts.",
          href: "/accounting/accounts",
        },
        {
          id: "correspondence",
          title: "Корреспонденция",
          description: "Управление posting matrix и проверкой консистентности.",
          href: "/accounting/correspondence",
        },
        {
          id: "reports",
          title: "Отчетность v2",
          description: "Trial Balance, GL, FS, Liquidity, FX, Fee Revenue, Close Package.",
          href: "/accounting/reports",
        },
      ]}
    />
  );
}
