import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";

const REPORT_LINKS = [
  {
    key: "trial-balance",
    title: "Оборотно-сальдовая ведомость (ОСВ)",
    description:
      "Входящее сальдо, дебет/кредит за период и исходящее сальдо по счетам и валютам.",
  },
  {
    key: "general-ledger",
    title: "Главная книга (карточка счета)",
    description: "Детализация движений по счету с нарастающим остатком.",
  },
  {
    key: "balance-sheet",
    title: "Бухгалтерский баланс",
    description: "Снимок финансового положения на дату по строкам отчетности.",
  },
  {
    key: "income-statement",
    title: "Отчет о финансовых результатах",
    description: "Доходы, расходы и чистый результат за период.",
  },
  {
    key: "cash-flow",
    title: "Отчет о движении денежных средств",
    description: "Денежные потоки прямым или косвенным методом.",
  },
  {
    key: "liquidity",
    title: "Позиция ликвидности",
    description: "Казначейская ликвидность в разрезе книг, организаций и валют.",
  },
  {
    key: "fx-revaluation",
    title: "Переоценка валютных позиций",
    description: "Разложение валютного результата на реализованную и нереализованную части.",
  },
  {
    key: "fee-revenue",
    title: "Анализ комиссионных доходов",
    description: "Доходы и расходы по продукту, каналу и контрагенту.",
  },
  {
    key: "close-package",
    title: "Пакет закрытия периода",
    description: "Артефакт закрытия периода с ревизиями и аудиторским следом.",
  },
] as const;

export default function AccountingReportsLandingPage() {
  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Отчеты бухгалтерии</CardTitle>
          <CardDescription>
            Единый раздел отчетности с фильтрацией по контрагенту, группе и книге.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 pt-4 md:grid-cols-2 xl:grid-cols-3">
          {REPORT_LINKS.map((item) => (
            <Link
              key={item.key}
              href={`/accounting/reports/${item.key}`}
              className="bg-card hover:bg-muted/40 rounded-md border p-4 transition-colors"
            >
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="text-muted-foreground mt-1 text-sm">{item.description}</p>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
