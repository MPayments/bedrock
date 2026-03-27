import * as React from "react";
import Link from "next/link";
import { Repeat } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { buildDocumentCreateHref, buildDocumentTypeHref } from "@/features/documents/lib/routes";
import { getFxQuotes } from "@/features/treasury/quotes/lib/queries";
import { getRateSources } from "@/features/treasury/rates/lib/queries";
import { formatDate } from "@/lib/format";

function ActionLink({
  href,
  label,
  variant = "outline",
}: {
  href: string | null;
  label: string;
  variant?: "default" | "outline";
}) {
  if (!href) {
    return null;
  }

  return (
    <Link
      href={href}
      className={
        variant === "default"
          ? "inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          : "inline-flex h-9 items-center justify-center rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:bg-muted"
      }
    >
      {label}
    </Link>
  );
}

export default async function TreasuryFxPage() {
  const fxCreateHref = buildDocumentCreateHref("fx_execute");
  const fxListHref = buildDocumentTypeHref("fx_execute");
  const [quotes, sources] = await Promise.all([
    getFxQuotes({ page: 1, perPage: 5 }),
    getRateSources(),
  ]);

  const staleSources = sources.filter((source) => source.isExpired).length;
  const activeQuotes = quotes.data.filter((quote) => quote.status === "active").length;

  return (
    <EntityListPageShell
      icon={Repeat}
      title="Казначейский FX"
      description="Отдельный операторский workspace для валютной конверсии: запуск FX, контроль котировок и проверка источников курса."
      fallback={<DataTableSkeleton columnCount={4} rowCount={6} filterCount={0} />}
    >
      <div className="space-y-4">
        <Card className="rounded-sm">
          <CardHeader className="border-b">
            <CardTitle>Как здесь работать</CardTitle>
            <CardDescription>
              Любой обмен валюты должен запускаться отсюда, а не через обычную
              treasury-операцию. FX всегда требует другой валюты назначения,
              котировки, курса и финансовых линий.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 pt-4 md:grid-cols-3">
            <div className="rounded-xl border px-4 py-3">
              <div className="text-sm font-medium">Когда нужен FX</div>
              <div className="text-muted-foreground mt-1 text-sm leading-6">
                Если актив меняется: USD → EUR, CNY → JPY, EUR → USDT и любой
                другой сценарий конверсии.
              </div>
            </div>
            <div className="rounded-xl border px-4 py-3">
              <div className="text-sm font-medium">Что проверить до отправки</div>
              <div className="text-muted-foreground mt-1 text-sm leading-6">
                Реквизиты источника и назначения должны быть разными и в разных
                валютах. Оператор должен видеть курс, комиссии и финансовые
                линии до подтверждения.
              </div>
            </div>
            <div className="rounded-xl border px-4 py-3">
              <div className="text-sm font-medium">Что отслеживать после запуска</div>
              <div className="text-muted-foreground mt-1 text-sm leading-6">
                Дальше важны судьба котировки, документ FX, события исполнения и
                все открытые позиции, которые появляются после обмена.
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="rounded-sm">
            <CardHeader className="border-b">
              <CardTitle>Запуск и рабочие переходы</CardTitle>
              <CardDescription>
                Treasury остается front door, но техническое создание FX сейчас
                идет через существующий документный сценарий.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex flex-wrap gap-2">
                <ActionLink href={fxCreateHref} label="Создать FX" variant="default" />
                <ActionLink href={fxListHref} label="Журнал FX-документов" />
                <ActionLink href="/treasury/quotes" label="Котировки" />
                <ActionLink href="/treasury/rates" label="Курсы" />
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border px-4 py-3">
                  <div className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
                    Активные котировки
                  </div>
                  <div className="mt-1 text-2xl font-semibold">{activeQuotes}</div>
                </div>
                <div className="rounded-xl border px-4 py-3">
                  <div className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
                    Всего источников
                  </div>
                  <div className="mt-1 text-2xl font-semibold">{sources.length}</div>
                </div>
                <div className="rounded-xl border px-4 py-3">
                  <div className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
                    Просроченные источники
                  </div>
                  <div className="mt-1 text-2xl font-semibold">{staleSources}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-sm">
            <CardHeader className="border-b">
              <CardTitle>Последние FX-котировки</CardTitle>
              <CardDescription>
                Быстрый обзор последних котировок без перехода в общий журнал.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {quotes.data.length === 0 ? (
                <div className="rounded-xl border border-dashed px-4 py-6">
                  <div className="text-sm font-medium">Котировок пока нет</div>
                  <div className="text-muted-foreground mt-1 text-sm leading-6">
                    Когда treasury начнет использовать FX-сценарий, здесь
                    появятся последние котировки и их состояние.
                  </div>
                </div>
              ) : (
                quotes.data.map((quote) => (
                  <div key={quote.id} className="rounded-xl border px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">
                          {quote.fromCurrency}/{quote.toCurrency}
                        </div>
                        <div className="text-muted-foreground mt-1 text-sm">
                          {quote.fromAmount} {quote.fromCurrency} → {quote.toAmount}{" "}
                          {quote.toCurrency}
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-medium">{quote.status}</div>
                        <div className="text-muted-foreground">
                          {formatDate(quote.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </EntityListPageShell>
  );
}
