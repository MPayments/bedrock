import { UserRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";

import type { ApiCustomerWorkspace } from "./types";

type CustomerCardProps = {
  customer: ApiCustomerWorkspace;
};

export function CustomerCard({ customer }: CustomerCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRound className="h-5 w-5 text-muted-foreground" />
          Клиент
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="text-sm font-medium text-muted-foreground">Customer</div>
          <div className="text-base font-medium">{customer.displayName}</div>
        </div>
        {customer.externalRef && (
          <div>
            <div className="text-sm font-medium text-muted-foreground">
              Внешний ID
            </div>
            <div className="text-base">{customer.externalRef}</div>
          </div>
        )}
        {customer.description && (
          <div>
            <div className="text-sm font-medium text-muted-foreground">
              Описание
            </div>
            <div className="text-base">{customer.description}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
