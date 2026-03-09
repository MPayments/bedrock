import { ChartCandlestick } from "lucide-react";

import { Separator } from "@multihansa/ui/components/separator";
import { Skeleton } from "@multihansa/ui/components/skeleton";

import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { CreateManualRateDialog } from "@/features/fx/rates/components/create-manual-rate-dialog";
import { RatePairsList } from "@/features/fx/rates/components/rate-pairs-list";
import { RateSourcesPanel } from "@/features/fx/rates/components/rate-sources-panel";
import {
  getCurrencyOptions,
  getRatePairs,
  getRateSources,
} from "@/features/fx/rates/lib/queries";

export default async function RatesPage() {
  const currencies = await getCurrencyOptions();

  return (
    <EntityListPageShell
      icon={ChartCandlestick}
      title="Курсы"
      description="Источники курсов валют, пары и ручные курсы."
      actions={<CreateManualRateDialog currencies={currencies} />}
      fallback={<RatesPageSkeleton />}
    >
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
  currencies: Awaited<ReturnType<typeof getCurrencyOptions>>;
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
