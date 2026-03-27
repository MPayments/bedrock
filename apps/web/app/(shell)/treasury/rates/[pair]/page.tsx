import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChartCandlestick, Plus } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { Separator } from "@bedrock/sdk-ui/components/separator";
import { Skeleton } from "@bedrock/sdk-ui/components/skeleton";

import {
  getRateHistory,
  getRatePairs,
} from "@/features/treasury/rates/lib/queries";
import { requirePageAudience } from "@/lib/auth/session";
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
  await requirePageAudience("admin");
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
        <SetPairManualRateDialog
          base={base}
          quote={quote}
          triggerClassName="w-full sm:w-auto"
          triggerSize="lg"
        >
          <>
            <Plus className="h-4 w-4" />
            Ручной курс
          </>
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
  const [historyResult, allPairs] = await Promise.all([
    getRateHistory(base, quote, from)
      .then((history) => ({ history, ok: true as const }))
      .catch((error) => ({ error, ok: false as const })),
    getRatePairs(),
  ]);

  const currentPair = allPairs.find(
    (p) => p.baseCurrencyCode === base && p.quoteCurrencyCode === quote,
  );

  if (!currentPair) notFound();

  if (!historyResult.ok) {
    return (
      <PairUnavailableState
        base={base}
        quote={quote}
        error={historyResult.error}
      />
    );
  }

  return (
    <RatePairView
      pair={currentPair}
      history={historyResult.history}
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

function PairUnavailableState({
  base,
  error,
  quote,
}: {
  base: string;
  error: unknown;
  quote: string;
}) {
  const message =
    error instanceof Error && error.message.length > 0
      ? error.message
      : "Историю курса не удалось построить.";

  return (
    <Card className="rounded-sm">
      <CardHeader className="border-b">
        <CardTitle>
          Нет рабочего маршрута курса для {base} / {quote}
        </CardTitle>
        <CardDescription>
          Это не обязательно сбой интерфейса. Чаще всего treasury просто не
          может построить пару из текущих источников и кросс-валютных путей.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        <div className="rounded-xl border px-4 py-3">
          <div className="text-sm font-medium">Что это значит</div>
          <div className="text-muted-foreground mt-1 text-sm leading-6">
            Для этой пары сейчас нет устойчивого автоматического курса или
            кросс-маршрута. Нужно проверить источники, anchor-валюту и при
            необходимости временно использовать ручной курс.
          </div>
        </div>
        <div className="rounded-xl border px-4 py-3">
          <div className="text-sm font-medium">Техническая причина</div>
          <div className="text-muted-foreground mt-1 text-sm leading-6">
            {message}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
