import { ChartCandlestick } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { Separator } from "@bedrock/sdk-ui/components/separator";
import { Skeleton } from "@bedrock/sdk-ui/components/skeleton";

import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { CreateManualRateDialog } from "@/features/treasury/rates/components/create-manual-rate-dialog";
import { RatePairsList } from "@/features/treasury/rates/components/rate-pairs-list";
import { RateSourcesPanel } from "@/features/treasury/rates/components/rate-sources-panel";
import {
  type CurrencyOption,
  getCurrencyOptions,
  getRatePairs,
  getRateSources,
} from "@/features/treasury/rates/lib/queries";
import { requirePageAudience } from "@/lib/auth/session";

export default async function RatesPage() {
  await requirePageAudience("admin");
  const currencies = await getCurrencyOptions();

  return (
    <EntityListPageShell
      icon={ChartCandlestick}
      title="Курсы"
      description="Мониторинг источников курса и ручное вмешательство, когда treasury не может опереться на автоматический маршрут."
      actions={<CreateManualRateDialog currencies={currencies} />}
      fallback={<RatesPageSkeleton />}
    >
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Как читать этот раздел</CardTitle>
          <CardDescription>
            Сначала смотрите здоровье источников, затем пары валют. Ручной курс
            нужен только как контролируемое вмешательство, когда автоматического
            маршрута или актуального источника нет.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 pt-4 md:grid-cols-3">
          <div className="rounded-xl border px-4 py-3">
            <div className="text-sm font-medium">Мониторинг</div>
            <div className="text-muted-foreground mt-1 text-sm leading-6">
              Проверяйте TTL и состояние источников, прежде чем объяснять
              проблему конкретной валютной парой.
            </div>
          </div>
          <div className="rounded-xl border px-4 py-3">
            <div className="text-sm font-medium">Пары валют</div>
            <div className="text-muted-foreground mt-1 text-sm leading-6">
              История пары показывает, есть ли устойчивый источник курса и как
              менялось значение во времени.
            </div>
          </div>
          <div className="rounded-xl border px-4 py-3">
            <div className="text-sm font-medium">Ручное вмешательство</div>
            <div className="text-muted-foreground mt-1 text-sm leading-6">
              Ручной курс используйте только когда понимаете причину отсутствия
              автоматического источника и готовы обосновать override.
            </div>
          </div>
        </CardContent>
      </Card>
      <RateSourcesLoader />
      <Separator className="w-full h-px" />
      <RatePairsLoader currencies={currencies} />
    </EntityListPageShell>
  );
}

async function RateSourcesLoader() {
  const sources = await getRateSources();
  return <RateSourcesPanel initialSources={sources} />;
}

async function RatePairsLoader({
  currencies,
}: {
  currencies: CurrencyOption[];
}) {
  const pairs = await getRatePairs();

  return <RatePairsList initialPairs={pairs} currencies={currencies} />;
}

function SourcesPanelSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Skeleton className="h-[180px] rounded-sm" />
      <Skeleton className="h-[180px] rounded-sm" />
    </div>
  );
}

function PairsListSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-14 rounded-md" />
      <Skeleton className="h-14 rounded-md" />
      <Skeleton className="h-14 rounded-md" />
    </div>
  );
}

function RatesPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <SourcesPanelSkeleton />
      <Separator className="w-full h-px" />
      <PairsListSkeleton />
    </div>
  );
}
