"use client";

import { Building2, FileText, Loader2, Phone, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import {
  type PortalCustomerContext,
  requestCustomerContexts,
} from "@/lib/customer-contexts";
import { isDuplicateCustomerLegalEntityName } from "@/lib/legal-entities";

export default function PortalClientsPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<PortalCustomerContext[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCustomerContexts() {
      try {
        const data = await requestCustomerContexts();
        setCustomers(data.data);
      } catch (error) {
        console.error("Error fetching clients:", error);
        router.push("/onboard");
      } finally {
        setLoading(false);
      }
    }

    void fetchCustomerContexts();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Мои организации</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {customers.length}{" "}
              {customers.length === 1
                ? "организация"
                : customers.length < 5
                  ? "организации"
                  : "организаций"}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className="gap-2"
          nativeButton={false}
          render={<Link href="/onboard" />}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Добавить</span>
        </Button>
      </div>

      <div className="space-y-3">
        {customers.map((customer) => (
          <Card
            key={customer.customerId}
            className="transition-colors hover:bg-muted/50"
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="h-5 w-5 shrink-0 text-primary" />
                  <CardTitle className="truncate text-base">
                    {customer.displayName}
                  </CardTitle>
                </div>
                {customer.externalRef ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Ref: {customer.externalRef}
                  </span>
                ) : null}
              </div>
              {customer.description ? (
                <CardDescription className="mt-1 text-sm">
                  {customer.description}
                </CardDescription>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    customer.agentAgreement.status === "active"
                      ? "success"
                      : "warning"
                  }
                >
                  {customer.agentAgreement.status === "active"
                    ? "Агентский договор действует"
                    : "Агентский договор не заключен"}
                </Badge>
                {customer.agentAgreement.contractNumber ? (
                  <span className="text-xs text-muted-foreground">
                    № {customer.agentAgreement.contractNumber}
                  </span>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {customer.legalEntities.map((legalEntity) => (
                  <div
                    key={legalEntity.counterpartyId}
                    className="rounded-lg border border-border/60 p-3"
                  >
                    <div className="min-w-0">
                      {!isDuplicateCustomerLegalEntityName({
                        customerDisplayName: customer.displayName,
                        legalEntityName: legalEntity.shortName,
                      }) ? (
                        <p className="truncate font-medium">
                          {legalEntity.shortName}
                        </p>
                      ) : null}
                      {legalEntity.inn ? (
                        <p className="text-xs text-muted-foreground">
                          ИНН: {legalEntity.inn}
                        </p>
                      ) : null}
                    </div>
                    {legalEntity.phone ? (
                      <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        <span>{legalEntity.phone}</span>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            В разработке
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Редактирование данных организации</li>
            <li>Просмотр заявок по организации</li>
            <li>Документы организации</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
