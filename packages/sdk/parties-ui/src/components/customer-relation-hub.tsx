"use client";

import { ArrowRight, Building2, CreditCard, Plus } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button, buttonVariants } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { cn } from "@bedrock/sdk-ui/lib/utils";

type RelationHubRequisite = {
  id: string;
  label: string;
  identity: string;
  currencyLabel: string;
  isDefault: boolean;
  openHref: string;
};

type RelationHubCounterparty = {
  id: string;
  shortName: string;
  fullName: string;
  country: string | null;
  kind: "legal_entity" | "individual";
  openHref: string;
  createRequisiteHref: string;
  requisites: RelationHubRequisite[];
};

type CustomerRelationHubProps = {
  counterparties: RelationHubCounterparty[];
  createCounterpartyHref: string;
};

export function CustomerRelationHub({
  counterparties,
  createCounterpartyHref,
}: CustomerRelationHubProps) {
  return (
    <div className="space-y-6">
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Связанные юридические лица</CardTitle>
              <CardDescription>
                Контрагенты клиента и их активные реквизиты.
              </CardDescription>
            </div>
            <a
              href={createCounterpartyHref}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <Plus className="size-4" />
              Добавить контрагента
            </a>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {counterparties.length === 0 ? (
            <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              У клиента пока нет связанных контрагентов.
            </div>
          ) : null}

          {counterparties.map((counterparty) => (
            <div key={counterparty.id} className="rounded-md border">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Building2 className="size-4 text-muted-foreground" />
                    <span className="font-medium">{counterparty.shortName}</span>
                    <Badge variant="outline">
                      {counterparty.kind === "individual"
                        ? "Физическое лицо"
                        : "Юридическое лицо"}
                    </Badge>
                    {counterparty.country ? (
                      <Badge variant="secondary">{counterparty.country}</Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {counterparty.fullName}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={counterparty.createRequisiteHref}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    <Plus className="size-4" />
                    Новый реквизит
                  </a>
                  <a
                    href={counterparty.openHref}
                    className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                  >
                    Открыть
                    <ArrowRight className="size-4" />
                  </a>
                </div>
              </div>
              <div className="space-y-3 px-4 py-3">
                {counterparty.requisites.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    У этого контрагента пока нет реквизитов.
                  </div>
                ) : (
                  counterparty.requisites.map((requisite) => (
                    <div
                      key={requisite.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <CreditCard className="size-4 text-muted-foreground" />
                          <span className="font-medium">{requisite.label}</span>
                          <Badge variant="outline">{requisite.currencyLabel}</Badge>
                          {requisite.isDefault ? (
                            <Badge>По умолчанию</Badge>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {requisite.identity}
                        </p>
                      </div>
                      <a
                        href={requisite.openHref}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                      >
                        Открыть
                        <ArrowRight className="size-4" />
                      </a>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
