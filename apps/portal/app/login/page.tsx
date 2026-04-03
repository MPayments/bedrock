import { ChevronLeft } from "lucide-react";
import { redirect } from "next/navigation";

import { AuthShell } from "@bedrock/sdk-ui/components/auth-shell";
import { Button } from "@bedrock/sdk-ui/components/button";
import { getServerSessionSnapshot } from "@/lib/auth/session";
import { CRM_BASE_URL } from "@/lib/constants";

import { CustomerLoginForm } from "./customer-login-form";

const APP_TITLE = process.env.NEXT_PUBLIC_APP_TITLE || "MPayments Portal";

export default async function PortalLoginPage() {
  const session = await getServerSessionSnapshot();

  if (session.isAuthenticated) {
    if (session.hasCustomerPortalAccess) {
      redirect("/clients");
    }

    if (session.hasOnboardingAccess) {
      redirect("/onboard");
    }
  }

  return (
    <AuthShell
      title={APP_TITLE}
      prelude={
        <Button
          variant="ghost"
          size="sm"
          className="h-9 self-start px-2"
          nativeButton={false}
          render={<a href={`${CRM_BASE_URL}/login`} />}
        >
          <ChevronLeft className="size-4" />
          Для сотрудников
        </Button>
      }
    >
      <CustomerLoginForm />
    </AuthShell>
  );
}
