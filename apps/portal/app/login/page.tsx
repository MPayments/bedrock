import { redirect } from "next/navigation";

import { AuthShell } from "@bedrock/sdk-ui/components/auth-shell";
import { getServerSessionSnapshot } from "@/lib/auth/session";

import { PortalLoginForm } from "./portal-login-form";

const APP_TITLE = process.env.NEXT_PUBLIC_APP_TITLE || "Multihansa Portal";

export default async function PortalLoginPage() {
  const session = await getServerSessionSnapshot();

  if (session.isAuthenticated) {
    if (session.hasCustomerPortalAccess) {
      redirect("/customers");
    }

    if (session.hasOnboardingAccess) {
      redirect("/onboard");
    }
  }

  return (
    <AuthShell title={APP_TITLE}>
      <PortalLoginForm />
    </AuthShell>
  );
}
