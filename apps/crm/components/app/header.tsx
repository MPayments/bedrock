"use client";

import { ArrowDownRight, ArrowUpRight, ChevronDown, Minus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { signOut } from "@/lib/auth-client";
import { PORTAL_BASE_URL } from "@/lib/constants";
import type { UserSessionSnapshot } from "@/lib/auth/types";

export function AppHeader({ session }: { session: UserSessionSnapshot }) {
  const router = useRouter();
  const [rates, setRates] = useState<{
    USD: number;
    EUR: number;
    CNY: number;
  } | null>(null);
  const [investingRates, setInvestingRates] = useState<{
    USD: { rate: number; trend?: "up" | "down" | "neutral" };
    EUR: { rate: number; trend?: "up" | "down" | "neutral" };
    CNY: { rate: number; trend?: "up" | "down" | "neutral" };
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInvestingLoading, setIsInvestingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [investingError, setInvestingError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    async function loadRates() {
      try {
        setIsLoading(true);
        setIsInvestingLoading(true);
        setError(null);
        setInvestingError(null);

        const currencies = ["USD", "EUR", "CNY"] as const;
        const results = await Promise.all(
          currencies.map(async (currency) => {
            try {
              const res = await fetch(
                `/v1/treasury/rates/latest?base=${currency}&quote=RUB`,
                { cache: "no-store", credentials: "include" },
              );
              if (!res.ok) return { currency, rate: null };
              const data = await res.json();
              const rate = Number(data.rateNum) / Number(data.rateDen || 1);
              return { currency, rate };
            } catch {
              return { currency, rate: null };
            }
          }),
        );

        if (isCancelled) return;

        const hasAny = results.some((r) => r.rate !== null);
        if (hasAny) {
          const ratesData = {} as { USD: number; EUR: number; CNY: number };
          const investingData = {} as {
            USD: { rate: number; trend?: "up" | "down" | "neutral" };
            EUR: { rate: number; trend?: "up" | "down" | "neutral" };
            CNY: { rate: number; trend?: "up" | "down" | "neutral" };
          };
          for (const r of results) {
            if (r.rate !== null) {
              ratesData[r.currency] = r.rate;
              investingData[r.currency] = { rate: r.rate, trend: "neutral" };
            }
          }
          setRates(ratesData);
          setInvestingRates(investingData);
        } else {
          setError("Нет данных");
          setInvestingError("Нет данных");
        }
      } catch {
        if (!isCancelled) {
          setError("Ошибка загрузки");
          setInvestingError("Ошибка загрузки");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
          setIsInvestingLoading(false);
        }
      }
    }
    loadRates();
    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <>
      <div className="w-full bg-background border-b">
        <header className="flex justify-between py-2  max-w-[1920px] mx-auto px-4 items-center">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex justify-center py-1 bg-background">
              <h1 className="text-xl font-bold">
                {process.env.NEXT_PUBLIC_APP_TITLE || "VED CRM"}
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
                  <Link href="/applications">Заявки</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
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
                  <Link href="/clients">Клиенты</Link>
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
                  <Link href="/documents">Документы</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`${navigationMenuTriggerStyle()} cursor-pointer flex items-center gap-2`}
                    >
                      Отчеты
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[200px]">
                    <DropdownMenuItem asChild>
                      <Link href="/reports/application">По заявкам</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/reports/deals">По сделкам</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/reports/clients">По клиентам</Link>
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
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-md bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 outline-none transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 font-semibold cursor-pointer">
                  <Avatar className="h-8 w-8 rounded-lg mr-2">
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
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[220px]">
                {session.hasCustomerPortalAccess ? (
                  <DropdownMenuItem asChild>
                    <a href={PORTAL_BASE_URL}>Кабинет клиента</a>
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
          <div className="flex items-center gap-4">
            <span className="font-medium">ЦБ:</span>
            {isLoading && <span>Загрузка…</span>}
            {error && !isLoading && (
              <span className="text-red-500">{error}</span>
            )}
            {rates && !isLoading && !error && (
              <div className="flex items-center gap-4 font-mono">
                {(["USD", "EUR", "CNY"] as const).map((cur) =>
                  rates[cur] != null ? (
                    <span key={cur} className="inline-flex items-center gap-1">
                      {cur} {rates[cur].toFixed(2)} ₽
                      <Minus className="h-3 w-3 text-gray-400" />
                    </span>
                  ) : (
                    <span key={cur} className="inline-flex items-center gap-1 text-muted-foreground">
                      {cur} —
                    </span>
                  ),
                )}
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-border" />

          <div className="flex items-center gap-4">
            <span className="font-medium">Investing:</span>
            {isInvestingLoading && <span>Загрузка…</span>}
            {investingError && !isInvestingLoading && (
              <span className="text-red-500">{investingError}</span>
            )}
            {investingRates && !isInvestingLoading && !investingError && (
              <div className="flex items-center gap-4 font-mono">
                {(["USD", "EUR", "CNY"] as const).map((cur) =>
                  investingRates[cur] ? (
                    <span key={cur} className="inline-flex items-center gap-1">
                      {cur} {investingRates[cur].rate.toFixed(2)} ₽
                      {investingRates[cur].trend === "up" && (
                        <ArrowUpRight className="h-3 w-3 text-green-600" />
                      )}
                      {investingRates[cur].trend === "down" && (
                        <ArrowDownRight className="h-3 w-3 text-red-600" />
                      )}
                      {investingRates[cur].trend === "neutral" && (
                        <Minus className="h-3 w-3 text-gray-400" />
                      )}
                    </span>
                  ) : (
                    <span key={cur} className="inline-flex items-center gap-1 text-muted-foreground">
                      {cur} —
                    </span>
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
