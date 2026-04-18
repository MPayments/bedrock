import { redirect } from "next/navigation";

import { getServerSessionSnapshot } from "@/lib/auth/session";

export default async function PortalRootPage() {
  const session = await getServerSessionSnapshot();

  if (!session.isAuthenticated) {
    redirect("/login");
  }

  if (session.hasCustomerPortalAccess) {
    redirect("/customers");
  }

  if (session.hasOnboardingAccess) {
    redirect("/onboard");
  }

  redirect("/login");
}
