import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChartCandlestick, Plus } from "lucide-react";

import { Button } from "@bedrock/ui/components/button";
import { Separator } from "@bedrock/ui/components/separator";
import { Skeleton } from "@bedrock/ui/components/skeleton";

import {
  getRateHistory,
  getRatePairs,
} from "@/features/fx/rates/lib/queries";
import { SetPairManualRateDialog } from "./components/set-pair-manual-rate-dialog";
import { RatePairView } from "./components/rate-pair-view";

const RANGE_DAYS: Record<string, number | undefined> = {
  "1D": 1,
  "1W": 7,
  "1M": 30,
  "6M": 180,
  "1Y": 365,
  ALL: undefined,
};

type TimeRangeKey = "1D" | "1W" | "1M" | "6M" | "1Y" | "ALL";

function rangeToFromDate(range: string | undefined): string | undefined {
  if (!range || !(range in RANGE_DAYS)) return undefined;
  const days = RANGE_DAYS[range];
  if (days == null) return undefined;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

interface RatePairPageProps {
  params: Promise<{ pair: string }>;
  searchParams: Promise<{ range?: string }>;
}

function parsePairParam(pair: string): { base: string; quote: string } | null {
  const decoded = decodeURIComponent(pair);
  const parts = decoded.split("-");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { base: parts[0].toUpperCase(), quote: parts[1].toUpperCase() };
}

export default async function RatePairPage({
  params,
  searchParams,
}: RatePairPageProps) {
  const { pair } = await params;
  const { range } = await searchParams;
  const parsed = parsePairParam(pair);
  if (!parsed) notFound();

  const { base, quote } = parsed;
  const timeRange: TimeRangeKey =
    range && range in RANGE_DAYS ? (range as TimeRangeKey) : "ALL";
  const from = rangeToFromDate(timeRange);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="bg-muted rounded-lg p-2.5">
            <ChartCandlestick className="text-muted-foreground h-5 w-5" />
          </div>
          <div>
            <h3 className="mb-1 text-xl font-semibold">
              {base} / {quote}
            </h3>
            <p className="text-muted-foreground hidden text-sm md:block">
              История курсов валютной пары по источникам.
            </p>
          </div>
        </div>
        <SetPairManualRateDialog base={base} quote={quote}>
          <Button size="lg" className="w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Ручной курс
          </Button>
        </SetPairManualRateDialog>
      </div>

      <Separator className="h-px w-full" />

      <Suspense fallback={<PairViewSkeleton />}>
        <PairViewLoader base={base} quote={quote} from={from} timeRange={timeRange} />
      </Suspense>
    </div>
  );
}

async function PairViewLoader({
  base,
  quote,
  from,
  timeRange,
}: {
  base: string;
  quote: string;
  from: string | undefined;
  timeRange: TimeRangeKey;
}) {
  const [history, allPairs] = await Promise.all([
    getRateHistory(base, quote, from),
    getRatePairs(),
  ]);

  const currentPair = allPairs.find(
    (p) => p.baseCurrencyCode === base && p.quoteCurrencyCode === quote,
  );

  if (!currentPair) notFound();

  return (
    <RatePairView
      pair={currentPair}
      history={history}
      timeRange={timeRange}
    />
  );
}

function PairViewSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-[350px] rounded-md" />
    </div>
  );
}
