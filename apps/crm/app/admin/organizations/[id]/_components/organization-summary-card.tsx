"use client";

import type { ReactNode } from "react";
import { Building2, FileSignature, Globe2, Stamp, Wallet } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import type { OrganizationWorkspaceRecord } from "../_lib/organization-workspace-api";

type OrganizationSummaryCardProps = {
  organization: OrganizationWorkspaceRecord;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function SummaryItem(props: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {props.icon}
        <span>{props.label}</span>
      </div>
      <p className="mt-1 text-sm font-medium">{props.value}</p>
    </div>
  );
}

export function OrganizationSummaryCard({
  organization,
}: OrganizationSummaryCardProps) {
  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">
              {organization.shortName || organization.fullName}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {organization.fullName}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={organization.isActive ? "default" : "secondary"}>
              {organization.isActive ? "Активна" : "Архивирована"}
            </Badge>
            <Badge variant="outline">
              {organization.kind === "legal_entity"
                ? "Юридическое лицо"
                : "Физическое лицо"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryItem
          icon={<Building2 className="size-4" />}
          label="Страна"
          value={organization.country ?? "Не указана"}
        />
        <SummaryItem
          icon={<Wallet className="size-4" />}
          label="Реквизиты"
          value={`${organization.banksCount} шт.`}
        />
        <SummaryItem
          icon={<FileSignature className="size-4" />}
          label="Подпись"
          value={organization.signatureUrl ? "Загружена" : "Не загружена"}
        />
        <SummaryItem
          icon={<Stamp className="size-4" />}
          label="Печать"
          value={organization.sealUrl ? "Загружена" : "Не загружена"}
        />
        <SummaryItem
          icon={<Globe2 className="size-4" />}
          label="Обновлено"
          value={formatDate(organization.updatedAt)}
        />
      </CardContent>
    </Card>
  );
}
