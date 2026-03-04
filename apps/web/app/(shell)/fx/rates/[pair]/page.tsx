import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChartCandlestick } from "lucide-react";

import { Separator } from "@bedrock/ui/components/separator";
import { Skeleton } from "@bedrock/ui/components/skeleton";

import {
  getRateHistory,
  getRatePairs,
  type SerializedRateHistoryPoint,
  type SerializedRatePair,
} from "../lib/queries";
import { RatePairView } from "./components/rate-pair-view";

interface RatePairPageProps {
  params: Promise<{ pair: string }>;
}

function parsePairParam(pair: string): { base: string; quote: string } | null {
  const decoded = decodeURIComponent(pair);
  const parts = decoded.split("-");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { base: parts[0].toUpperCase(), quote: parts[1].toUpperCase() };
}

export default async function RatePairPage({ params }: RatePairPageProps) {
  const { pair } = await params;
  const parsed = parsePairParam(pair);
  if (!parsed) notFound();

  const { base, quote } = parsed;

  return (
    <div className="flex flex-col gap-6">
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

      <Separator className="h-px w-full" />

      <Suspense fallback={<PairViewSkeleton />}>
        <PairViewLoader base={base} quote={quote} />
      </Suspense>
    </div>
  );
}

async function PairViewLoader({
  base,
  quote,
}: {
  base: string;
  quote: string;
}) {
  const [history, allPairs] = await Promise.all([
    getRateHistory(base, quote),
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
