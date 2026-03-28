import Link from "next/link";
import { Vault } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import { SectionOverviewPage } from "@/features/overview/ui/section-overview-page";
import { getFxQuotes } from "@/features/treasury/quotes/lib/queries";
import { getRateSources } from "@/features/treasury/rates/lib/queries";
import {
  listTreasuryAccounts,
  listTreasuryOperations,
  listTreasuryPositions,
  listUnmatchedExternalRecords,
} from "@/features/treasury/workbench/lib/queries";

function formatCount(value: number) {
  return value.toLocaleString("ru-RU");
}

export default async function TreasuryOverviewPage() {
  const [accounts, operations, positions, unmatchedRecords, sources, quotes] =
    await Promise.all([
      listTreasuryAccounts(),
      listTreasuryOperations({ limit: 100 }),
      listTreasuryPositions(),
      listUnmatchedExternalRecords({ limit: 100 }),
      getRateSources(),
      getFxQuotes({ page: 1, perPage: 1 }),
    ]);
  const staleSources = sources.filter((source) => source.isExpired).length;
  const openPositions = positions.filter((position) => position.closedAt === null);

  return (
    <SectionOverviewPage
      icon={Vault}
      title="Казначейство"
      description="Операционная панель для ручного казначейского процесса: счета, операции, позиции и исключения сверки."
      aside={
        <Card className="rounded-sm">
          <CardHeader className="border-b">
            <CardTitle>Казначейский FX</CardTitle>
            <CardDescription>
              Конверсию валюты запускайте из treasury, а не из Documents workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <p className="text-muted-foreground text-sm">
              Создание FX использует `fx_execute` как артефакт исполнения, но
              стартует из treasury.
            </p>
            <Button nativeButton={false} render={<Link href="/treasury/quotes/create" />}>
              Открыть FX
            </Button>
          </CardContent>
        </Card>
      }
      stats={[
        {
          id: "accounts",
          label: "Счета казначейства",
          value: formatCount(accounts.length),
          description: "Исполняемые счета с текущими учтенными и доступными остатками.",
          href: "/treasury/accounts",
        },
        {
          id: "operations",
          label: "Операции",
          value: formatCount(operations.length),
          description: "Последние выплаты, поступления, переводы и возвраты без смены валюты.",
          href: "/treasury/operations",
        },
        {
          id: "quotes",
          label: "FX-котировки",
          value: formatCount(quotes.total),
          description:
            staleSources > 0
              ? `Есть ${formatCount(staleSources)} просроченных источников курса`
              : "Последние котировки и курсовые данные доступны в журналах treasury.",
          href: "/treasury/quotes",
        },
        {
          id: "sources",
          label: "FX-источники",
          value: formatCount(sources.length),
          description:
            staleSources > 0
              ? `Просроченных источников: ${formatCount(staleSources)}`
              : "Все источники курсов актуальны в пределах TTL.",
          href: "/treasury/rates",
        },
        {
          id: "positions",
          label: "Открытые позиции",
          value: formatCount(openPositions.length),
          description:
            unmatchedRecords.length > 0
              ? `Есть ${formatCount(unmatchedRecords.length)} несопоставленных внешних записей`
              : "Внешние записи сверки сейчас сопоставлены.",
          href: "/treasury/positions",
        },
      ]}
      links={[
        {
          id: "operations",
          title: "Операции",
          description: "Лента ручных операций с переходом в карточку и хронологию событий.",
          href: "/treasury/operations",
        },
        {
          id: "accounts",
          title: "Счета",
          description: "Сводка по исполняемым счетам казначейства и их остаткам.",
          href: "/treasury/accounts",
        },
        {
          id: "positions",
          title: "Позиции",
          description: "Клиентские и межкомпанейские позиции с ручным погашением.",
          href: "/treasury/positions",
        },
        {
          id: "unmatched",
          title: "Исключения",
          description:
            "Внешние записи сверки и другие исключения, которые ещё не привязаны к событиям исполнения.",
          href: "/treasury/unmatched",
        },
        {
          id: "rates",
          title: "Курсы",
          description: "Источники, TTL и ручная установка курсов.",
          href: "/treasury/rates",
        },
        {
          id: "quotes",
          title: "Котировки",
          description: "Журнал валютных котировок со статусом и деталями.",
          href: "/treasury/quotes",
        },
        {
          id: "organizations",
          title: "Организации",
          description: "Организации-владельцы казначейских потоков и внутренних книг.",
          href: "/treasury/organizations",
        },
      ].slice(0, 6)}
    />
  );
}
