import { Building2, PanelsTopLeft } from "lucide-react";
import { redirect } from "next/navigation";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { getServerSessionSnapshot } from "@/lib/auth/session";
import { CRM_BASE_URL } from "@/lib/constants";

export default async function PortalRootPage() {
  const session = await getServerSessionSnapshot();

  if (!session.isAuthenticated) {
    redirect("/login");
  }

  if (session.hasCustomerPortalAccess) {
    redirect("/clients");
  }

  if (!session.hasCrmAccess) {
    redirect("/onboard");
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Building2 className="h-5 w-5 text-primary" />
            Доступ к порталу не настроен
          </CardTitle>
          <CardDescription>
            Этот аккаунт авторизован во внутренней CRM, но к клиентскому
            кабинету он сейчас не привязан.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Если вам нужен рабочий интерфейс, откройте CRM. Для клиентского
            кабинета используйте аккаунт с активным доступом в портал. Чтобы
            сменить аккаунт, выйдите через меню профиля.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              nativeButton={false}
              render={<a href={CRM_BASE_URL} />}
              className="gap-2"
            >
              <PanelsTopLeft className="h-4 w-4" />
              Открыть CRM
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
