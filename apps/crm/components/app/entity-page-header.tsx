"use client";

import { Fragment, isValidElement, type ReactNode } from "react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { cn } from "@bedrock/sdk-ui/lib/utils";

type EntityPageHeaderBadge = {
  label: string;
  variant: "default" | "secondary" | "success" | "warning";
};

type EntityPageHeaderAvatar = {
  icon?: ReactNode;
  initials?: string;
};

type EntityPageHeaderProps = {
  actions?: ReactNode;
  avatar: EntityPageHeaderAvatar;
  badge?: EntityPageHeaderBadge;
  className?: string;
  infoItems?: ReactNode[];
  title: string;
  titleSecondary?: string;
};

export function EntityPageHeader({
  actions,
  avatar,
  badge,
  className,
  infoItems,
  title,
  titleSecondary,
}: EntityPageHeaderProps) {
  const items = (infoItems ?? []).filter(
    (item) =>
      item !== null &&
      item !== undefined &&
      item !== "" &&
      (!isValidElement(item) || item.key !== "id"),
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="bg-background text-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-medium">
          {avatar.initials ?? avatar.icon ?? "··"}
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-bold">{title}</h1>
            {badge ? (
              <Badge variant={badge.variant} className="gap-1.5">
                <span
                  aria-hidden
                  className="size-1.5 shrink-0 rounded-full bg-current opacity-80"
                />
                {badge.label}
              </Badge>
            ) : null}
          </div>
          {titleSecondary ? (
            <div className="truncate font-mono text-xs text-muted-foreground">
              {titleSecondary}
            </div>
          ) : null}
          {items.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {items.map((item, index) => (
                <Fragment key={index}>
                  {index > 0 ? <span aria-hidden>·</span> : null}
                  <span>{item}</span>
                </Fragment>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex w-full flex-col items-stretch gap-2 lg:w-auto lg:items-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function getEntityInitials(name: string | null | undefined): string {
  if (!name) {
    return "··";
  }
  const parts = name
    .trim()
    .split(/\s+/u)
    .map((part) => part.replace(/^[^0-9\p{L}]+|[^0-9\p{L}]+$/gu, ""))
    .filter(Boolean);

  if (parts.length === 0) {
    return "··";
  }

  if (parts.length === 1) {
    const firstPart = parts[0] ?? "";
    return Array.from(firstPart)
      .slice(0, 2)
      .join("")
      .toLocaleUpperCase("ru-RU");
  }

  return parts
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? "")
    .join("")
    .toLocaleUpperCase("ru-RU");
}
