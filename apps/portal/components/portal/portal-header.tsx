"use client";

import { Briefcase, Building2, LogOut, PanelsTopLeft } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Avatar, AvatarFallback } from "@bedrock/sdk-ui/components/avatar";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@bedrock/sdk-ui/components/dropdown-menu";
import { signOut } from "@/lib/auth-client";
import { CRM_BASE_URL } from "@/lib/constants";
import type { UserSessionSnapshot } from "@/lib/auth/types";
import { cn } from "@/lib/utils";

const navItems = [
  {
    href: "/clients",
    label: "Организации",
    icon: Building2,
  },
  {
    href: "/deals",
    label: "Сделки",
    icon: Briefcase,
  },
];

export function PortalHeader({ session }: { session: UserSessionSnapshot }) {
  const pathname = usePathname();
  const router = useRouter();
  const showPortalNavigation = session.hasCustomerPortalAccess;

  const userName = session.user?.name || "";
  const userEmail = session.user?.email || "";
  const initials = userName
    ? userName
        .split(" ")
        .map((part: string) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : userEmail.slice(0, 2).toUpperCase();

  async function handleLogout() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 md:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-primary">M</span>
          <span className="hidden text-lg font-semibold sm:inline">
            Multihansa Portal
          </span>
        </div>

        {showPortalNavigation ? (
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        ) : (
          <div className="hidden text-sm text-muted-foreground md:block">
            Клиентский доступ не настроен
          </div>
        )}

        <div className="flex items-center gap-2">
          {session.canAccessDashboard ? (
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              nativeButton={false}
              render={<a href={CRM_BASE_URL} />}
            >
              <PanelsTopLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Открыть CRM</span>
            </Button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="sm" className="h-9 gap-2 px-2 sm:px-3" />}
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary/10 text-xs text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[140px] truncate sm:inline">
                {userName || userEmail}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-0.5">
                    <p className="truncate text-sm font-medium">
                      {userName || "Клиент"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {userEmail}
                    </p>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              {session.canAccessDashboard ? (
                <DropdownMenuItem render={<a href={CRM_BASE_URL} />}>
                  Открыть CRM
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Выйти
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
