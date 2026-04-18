"use client";

import { ChevronDown, Minus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { formatFractionDecimal } from "@bedrock/shared/money";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@bedrock/sdk-ui/components/dropdown-menu";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@bedrock/sdk-ui/components/avatar";
import { signOut } from "@/lib/auth-client";
import { PORTAL_BASE_URL } from "@/lib/constants";
import type { UserSessionSnapshot } from "@/lib/auth/types";

type CurrencyCode = "USD" | "EUR" | "CNY";
type HeaderRateSource = "cbr" | "investing";
type SourceRates = Partial<Record<CurrencyCode, string>>;
type SourceRateDto = {
  source: string;
  rateNum: string;
  rateDen: string;
};
type RatePairDto = {
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  rates: SourceRateDto[];
};
type RatePairsResponseDto = {
  data?: RatePairDto[];
};

const HEADER_CURRENCIES = ["USD", "EUR", "CNY"] as const;
const HEADER_SOURCES = ["cbr", "investing"] as const;
const HEADER_RATES_POLL_INTERVAL_MS = 60_000;

function isHeaderCurrency(value: string): value is CurrencyCode {
  return HEADER_CURRENCIES.includes(value as CurrencyCode);
}

async function fetchHeaderRates(): Promise<Record<HeaderRateSource, SourceRates>> {
  const res = await fetch("/v1/treasury/rates/pairs", {
    cache: "no-store",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`Failed to load treasury pairs: ${res.status}`);
  }

  const payload = (await res.json()) as RatePairsResponseDto;
  const pairs = Array.isArray(payload.data) ? payload.data : [];
  const nextRates: Record<HeaderRateSource, SourceRates> = {
    cbr: {},
    investing: {},
  };

  for (const pair of pairs) {
    if (pair.quoteCurrencyCode !== "RUB" || !isHeaderCurrency(pair.baseCurrencyCode)) {
      continue;
    }

    for (const source of HEADER_SOURCES) {
      const sourceRate = pair.rates.find((rate) => rate.source === source);
      if (!sourceRate) {
        continue;
      }

      nextRates[source][pair.baseCurrencyCode] = formatFractionDecimal(
        sourceRate.rateNum,
        sourceRate.rateDen || "1",
        {
          scale: 2,
          trimTrailingZeros: false,
        },
      );
    }
  }

  return nextRates;
}

export function AppHeader({ session }: { session: UserSessionSnapshot }) {
  const router = useRouter();
  const [cbrRates, setCbrRates] = useState<SourceRates | null>(null);
  const [investingRates, setInvestingRates] = useState<SourceRates | null>(
    null,
  );
  const [isCbrLoading, setIsCbrLoading] = useState(false);
  const [isInvestingLoading, setIsInvestingLoading] = useState(false);
  const [cbrError, setCbrError] = useState<string | null>(null);
  const [investingError, setInvestingError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    let timeoutId: number | undefined;

    async function loadRates() {
      try {
        setIsCbrLoading(true);
        setIsInvestingLoading(true);
        setCbrError(null);
        setInvestingError(null);

        const nextRates = await fetchHeaderRates();
        const nextCbrRates = nextRates.cbr;
        const nextInvestingRates = nextRates.investing;

        if (isCancelled) {
          return;
        }

        if (Object.keys(nextCbrRates).length > 0) {
          setCbrRates(nextCbrRates);
        } else {
          setCbrRates(null);
          setCbrError("Нет данных");
        }

        if (Object.keys(nextInvestingRates).length > 0) {
          setInvestingRates(nextInvestingRates);
        } else {
          setInvestingRates(null);
          setInvestingError("Нет данных");
        }
      } catch {
        if (!isCancelled) {
          setCbrRates(null);
          setInvestingRates(null);
          setCbrError("Ошибка загрузки");
          setInvestingError("Ошибка загрузки");
        }
      } finally {
        if (!isCancelled) {
          setIsCbrLoading(false);
          setIsInvestingLoading(false);
          timeoutId = window.setTimeout(
            loadRates,
            HEADER_RATES_POLL_INTERVAL_MS,
          );
        }
      }
    }

    void loadRates();

    return () => {
      isCancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <>
      <div className="w-full bg-background border-b">
        <header className="flex justify-between py-2  max-w-[1920px] mx-auto px-4 items-center">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex justify-center py-1 bg-background">
              <h1 className="text-xl font-bold">
                {process.env.NEXT_PUBLIC_APP_TITLE || "Multihansa CRM"}
              </h1>
            </div>
          </Link>
          <NavigationMenu viewport={false} delayDuration={Infinity}>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuLink
                  asChild
                  className={navigationMenuTriggerStyle()}
                >
                  <Link href="/deals">Сделки</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink
                  asChild
                  className={navigationMenuTriggerStyle()}
                >
                  <Link href="/customers">Клиенты</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink
                  asChild
                  className={navigationMenuTriggerStyle()}
                >
                  <Link href="/calendar">Календарь</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink
                  asChild
                  className={navigationMenuTriggerStyle()}
                >
                  <Link href="/calendar">Календарь</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        className={`${navigationMenuTriggerStyle()} flex cursor-pointer items-center gap-2`}
                      />
                    }
                  >
                    Отчеты
                    <ChevronDown className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[200px]">
                    <DropdownMenuItem render={<Link href="/reports/deals" />}>
                      По сделкам
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      render={<Link href="/reports/customers" />}
                    >
                      По клиентам
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </NavigationMenuItem>
              {session.role === "admin" && (
                <NavigationMenuItem>
                  <NavigationMenuLink
                    asChild
                    className={navigationMenuTriggerStyle()}
                  >
                    <Link href="/admin/organizations">Юрлица</Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              )}
              {session.role === "admin" && (
                <NavigationMenuItem>
                  <NavigationMenuLink
                    asChild
                    className={navigationMenuTriggerStyle()}
                  >
                    <Link href="/admin/users">Пользователи</Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              )}
            </NavigationMenuList>
          </NavigationMenu>
          <div className="flex items-center gap-3">
            {session.hasCustomerPortalAccess ? (
              <a
                href={PORTAL_BASE_URL}
                className="hidden md:inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent"
              >
                Кабинет клиента
              </a>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="flex cursor-pointer items-center gap-2 rounded-md bg-background px-4 py-2 text-sm font-semibold font-medium outline-none transition-[color,box-shadow] hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50"
                  />
                }
              >
                <Avatar className="mr-2 h-8 w-8 rounded-lg">
                  <AvatarImage src="https://github.com/shadcn.png" />
                  <AvatarFallback className="bg-muted">CN</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {session.user?.name ?? "—"}
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    {session.user?.email ?? ""}
                  </span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[220px]">
                {session.hasCustomerPortalAccess ? (
                  <DropdownMenuItem render={<a href={PORTAL_BASE_URL} />}>
                    Кабинет клиента
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    router.push("/login");
                    router.refresh();
                  }}
                >
                  Выйти
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {/* <div>user</div> */}
        </header>
      </div>

      <div className="flex justify-center border-b py-1 bg-background">
        <div className="text-sm flex items-center gap-6">
          <SourceRatesTicker
            label="ЦБ:"
            rates={cbrRates}
            isLoading={isCbrLoading}
            error={cbrError}
          />

          <div className="h-4 w-px bg-border" />

          <SourceRatesTicker
            label="Investing:"
            rates={investingRates}
            isLoading={isInvestingLoading}
            error={investingError}
          />
        </div>
      </div>
    </>
  );
}

function SourceRatesTicker({
  label,
  rates,
  isLoading,
  error,
}: {
  label: string;
  rates: SourceRates | null;
  isLoading: boolean;
  error: string | null;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="font-medium">{label}</span>
      {isLoading && <span>Загрузка…</span>}
      {error && !isLoading && <span className="text-red-500">{error}</span>}
      {rates && !isLoading && !error && (
        <div className="flex items-center gap-4 font-mono">
          {HEADER_CURRENCIES.map((currency) =>
            rates[currency] != null ? (
              <span key={currency} className="inline-flex items-center gap-1">
                {currency} {rates[currency]} ₽
                <Minus className="h-3 w-3 text-gray-400" />
              </span>
            ) : (
              <span
                key={currency}
                className="inline-flex items-center gap-1 text-muted-foreground"
              >
                {currency} —
              </span>
            ),
          )}
        </div>
      )}
    </div>
  );
}
