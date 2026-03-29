"use client";

import { Briefcase, Building2, FileText, LogOut, PanelsTopLeft } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    href: "/applications",
    label: "Заявки",
    icon: FileText,
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

  const userName = session.user?.name || "";
  const userEmail = session.user?.email || "";
  const initials = userName
    ? userName
        .split(" ")
        .map((part) => part[0])
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
            MPayments Portal
          </span>
        </div>

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

        <div className="flex items-center gap-2">
          {session.canAccessDashboard ? (
            <Button variant="outline" size="sm" asChild className="h-9">
              <a href={CRM_BASE_URL}>
                <PanelsTopLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Открыть CRM</span>
              </a>
            </Button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 gap-2 px-2 sm:px-3">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-primary/10 text-xs text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[140px] truncate sm:inline">
                  {userName || userEmail}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
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
              <DropdownMenuSeparator />
              {session.canAccessDashboard ? (
                <DropdownMenuItem asChild>
                  <a href={CRM_BASE_URL}>Открыть CRM</a>
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
