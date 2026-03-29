import { ChevronLeft } from "lucide-react";
import { redirect } from "next/navigation";

import { Button } from "@bedrock/sdk-ui/components/button";
import { getServerSessionSnapshot } from "@/lib/auth/session";
import { CRM_BASE_URL } from "@/lib/constants";

import { CustomerLoginForm } from "./customer-login-form";

export default async function PortalLoginPage() {
  const session = await getServerSessionSnapshot();

  if (session.isAuthenticated) {
    if (session.hasCustomerPortalAccess) {
      redirect("/");
    }
    redirect("/");
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <div className="p-4">
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-2"
          nativeButton={false}
          render={<a href={`${CRM_BASE_URL}/login`} />}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Для сотрудников
        </Button>
      </div>

      <div className="flex flex-1 flex-col justify-center px-6 pb-safe">
        <div className="mx-auto w-full max-w-sm">
          <CustomerLoginForm />
        </div>
      </div>

      <div className="p-6 text-center">
        <span className="text-xs text-muted-foreground">MPayments Portal</span>
      </div>
    </div>
  );
}
