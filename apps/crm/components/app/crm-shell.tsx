"use client";

import type { ReactNode } from "react";

import { AppHeader } from "@/components/app/header";
import type { UserSessionSnapshot } from "@/lib/auth/types";

import { CrmBreadcrumbsProvider } from "./breadcrumbs-provider";

export function CrmShell({
  children,
  session,
}: Readonly<{
  children: ReactNode;
  session: UserSessionSnapshot;
}>) {
  return (
    <CrmBreadcrumbsProvider>
      <AppHeader session={session} />
      <main className="mx-auto max-w-[1920px] p-4">{children}</main>
    </CrmBreadcrumbsProvider>
  );
}
