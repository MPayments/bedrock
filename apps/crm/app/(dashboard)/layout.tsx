import type { ReactNode } from "react";

import { CrmShell } from "@/components/app/crm-shell";
import { requireDashboardSession } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const session = await requireDashboardSession();

  return <CrmShell session={session}>{children}</CrmShell>;
}
