"use client";

import { ArrowDownRight, ArrowUpRight, ChevronDown, Minus } from "lucide-react";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { API_BASE_URL } from "@/lib/constants";
import { signOut, useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export function AppHeader() {
  const router = useRouter();
  const { data: session } = useSession();
  const [rates, setRates] = useState<{
    USD: number;
    EUR: number;
    CNY: number;
  } | null>(null);
  const [prevRates, setPrevRates] = useState<{
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
        setError(null);

        const currencies = ["USD", "EUR", "CNY"];
        const promises = currencies.map(async (currency) => {
          const res = await fetch(
            `/v1/treasury/rates/latest?base=${currency}&quote=RUB`,
            {
              cache: "no-store",
              credentials: "include",
            },
          );
          if (!res.ok) throw new Error(`Failed to fetch ${currency}`);
          const data = await res.json();
          const rate = Number(data.rateNum) / Number(data.rateDen || 1);
          return {
            currency,
            rate,
            previous: rate,
          };
        });

        const results = await Promise.all(promises);
        if (!isCancelled) {
          const ratesData = results.reduce(
            (acc, { currency, rate }) => {
              acc[currency as "USD" | "EUR" | "CNY"] = rate;
              return acc;
            },
            {} as {
              USD: number;
              EUR: number;
              CNY: number;
            },
          );

          const prevRatesData = results.reduce(
            (acc, { currency, previous }) => {
              if (typeof previous === "number") {
                acc[currency as "USD" | "EUR" | "CNY"] = previous;
              }
              return acc;
            },
            {} as {
              USD?: number;
              EUR?: number;
              CNY?: number;
            },
          );

          setRates(ratesData);
          if (prevRatesData.USD && prevRatesData.EUR && prevRatesData.CNY) {
            setPrevRates({
              USD: prevRatesData.USD,
              EUR: prevRatesData.EUR,
              CNY: prevRatesData.CNY,
            });
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("CBR rates error:", err);
          setError("Ошибка загрузки");
        }
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }
    loadRates();
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadInvestingRates() {
      try {
        setIsInvestingLoading(true);
        setInvestingError(null);

        const currencies = ["USD", "EUR", "CNY"];
        const promises = currencies.map(async (currency) => {
          const res = await fetch(
            `/v1/treasury/rates/latest?base=${currency}&quote=RUB`,
            {
              cache: "no-store",
              credentials: "include",
            },
          );
          if (!res.ok) throw new Error(`Failed to fetch ${currency}`);
          const data = await res.json();
          const rate = Number(data.rateNum) / Number(data.rateDen || 1);
          return {
            currency,
            rate,
            trend: "neutral" as const,
          };
        });

        const results = await Promise.all(promises);
        // const results = [
        //   { currency: "USD", rate: 30, trend: "up" },
        //   { currency: "EUR", rate: 40, trend: "up" },
        //   { currency: "CNY", rate: 5, trend: "up" },
        // ] as {
        //   currency: "USD" | "EUR" | "CNY";
        //   rate: number;
        //   trend?: "up" | "down" | "neutral";
        // }[];
        if (!isCancelled) {
          const ratesData = results.reduce(
            (acc, { currency, rate, trend }) => {
              acc[currency as "USD" | "EUR" | "CNY"] = { rate, trend };
              return acc;
            },
            {} as {
              USD: { rate: number; trend?: "up" | "down" | "neutral" };
              EUR: { rate: number; trend?: "up" | "down" | "neutral" };
              CNY: { rate: number; trend?: "up" | "down" | "neutral" };
            },
          );

          setInvestingRates(ratesData);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("Investing rates error:", err);
          setInvestingError("Ошибка загрузки");
        }
      } finally {
        if (!isCancelled) setIsInvestingLoading(false);
      }
    }

    loadInvestingRates();
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
              {(session?.user as any)?.isAdmin && (
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-md bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 outline-none transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 font-semibold cursor-pointer">
                <Avatar className="h-8 w-8 rounded-lg mr-2">
                  <AvatarImage src="https://github.com/shadcn.png" />
                  <AvatarFallback className="bg-muted">CN</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {session?.user?.name ?? "—"}
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    {session?.user?.email ?? ""}
                  </span>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <DropdownMenuItem asChild>
                <Link href="#">Профиль</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="#"
                  onClick={async (e) => {
                    e.preventDefault();
                    await signOut();
                    router.push("/login");
                  }}
                >
                  Выйти
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                <span className="inline-flex items-center gap-1">
                  USD {rates.USD.toFixed(2)} ₽
                  {prevRates &&
                    (rates.USD > prevRates.USD ? (
                      <ArrowUpRight className="h-3 w-3 text-green-600" />
                    ) : rates.USD < prevRates.USD ? (
                      <ArrowDownRight className="h-3 w-3 text-red-600" />
                    ) : (
                      <Minus className="h-3 w-3 text-gray-400" />
                    ))}
                </span>
                <span className="inline-flex items-center gap-1">
                  EUR {rates.EUR.toFixed(2)} ₽
                  {prevRates &&
                    (rates.EUR > prevRates.EUR ? (
                      <ArrowUpRight className="h-3 w-3 text-green-600" />
                    ) : rates.EUR < prevRates.EUR ? (
                      <ArrowDownRight className="h-3 w-3 text-red-600" />
                    ) : (
                      <Minus className="h-3 w-3 text-gray-400" />
                    ))}
                </span>
                <span className="inline-flex items-center gap-1">
                  CNY {rates.CNY.toFixed(2)} ₽
                  {prevRates &&
                    (rates.CNY > prevRates.CNY ? (
                      <ArrowUpRight className="h-3 w-3 text-green-600" />
                    ) : rates.CNY < prevRates.CNY ? (
                      <ArrowDownRight className="h-3 w-3 text-red-600" />
                    ) : (
                      <Minus className="h-3 w-3 text-gray-400" />
                    ))}
                </span>
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
                <span className="inline-flex items-center gap-1">
                  USD {investingRates.USD.rate.toFixed(2)} ₽
                  {investingRates.USD.trend === "up" && (
                    <ArrowUpRight className="h-3 w-3 text-green-600" />
                  )}
                  {investingRates.USD.trend === "down" && (
                    <ArrowDownRight className="h-3 w-3 text-red-600" />
                  )}
                  {investingRates.USD.trend === "neutral" && (
                    <Minus className="h-3 w-3 text-gray-400" />
                  )}
                </span>
                <span className="inline-flex items-center gap-1">
                  EUR {investingRates.EUR.rate.toFixed(2)} ₽
                  {investingRates.EUR.trend === "up" && (
                    <ArrowUpRight className="h-3 w-3 text-green-600" />
                  )}
                  {investingRates.EUR.trend === "down" && (
                    <ArrowDownRight className="h-3 w-3 text-red-600" />
                  )}
                  {investingRates.EUR.trend === "neutral" && (
                    <Minus className="h-3 w-3 text-gray-400" />
                  )}
                </span>
                <span className="inline-flex items-center gap-1">
                  CNY {investingRates.CNY.rate.toFixed(2)} ₽
                  {investingRates.CNY.trend === "up" && (
                    <ArrowUpRight className="h-3 w-3 text-green-600" />
                  )}
                  {investingRates.CNY.trend === "down" && (
                    <ArrowDownRight className="h-3 w-3 text-red-600" />
                  )}
                  {investingRates.CNY.trend === "neutral" && (
                    <Minus className="h-3 w-3 text-gray-400" />
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
