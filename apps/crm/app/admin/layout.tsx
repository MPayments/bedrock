import type { ReactNode } from "react";

import { CrmShell } from "@/components/app/crm-shell";
import { requireAdminSession } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const session = await requireAdminSession();

  return <CrmShell session={session}>{children}</CrmShell>;
}
