import { Suspense } from "react";
import { ChartCandlestick } from "lucide-react";

import { Separator } from "@bedrock/ui/components/separator";
import { Skeleton } from "@bedrock/ui/components/skeleton";

import { RateSourcesPanel } from "./components/rate-sources-panel";
import { RatePairsList } from "./components/rate-pairs-list";
import { getCurrencyOptions, getRatePairs, getRateSources } from "./lib/queries";

export default function RatesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <div className="bg-muted rounded-lg p-2.5">
          <ChartCandlestick className="text-muted-foreground h-5 w-5" />
        </div>
        <div>
          <h3 className="mb-1 text-xl font-semibold">Курсы</h3>
          <p className="text-muted-foreground text-sm hidden md:block">
            Источники курсов валют, пары и ручные курсы.
          </p>
        </div>
      </div>

      <Separator className="w-full h-px" />

      <Suspense fallback={<SourcesPanelSkeleton />}>
        <RateSourcesLoader />
      </Suspense>

      <Separator className="w-full h-px" />

      <Suspense fallback={<PairsListSkeleton />}>
        <RatePairsLoader />
      </Suspense>
    </div>
  );
}

async function RateSourcesLoader() {
  const sources = await getRateSources();
  return <RateSourcesPanel initialSources={sources} />;
}

async function RatePairsLoader() {
  const [pairs, currencies] = await Promise.all([
    getRatePairs(),
    getCurrencyOptions(),
  ]);
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-14 rounded-md" />
        <Skeleton className="h-14 rounded-md" />
        <Skeleton className="h-14 rounded-md" />
      </div>
    </div>
  );
}
