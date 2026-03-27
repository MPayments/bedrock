import * as React from "react";

import { cn } from "@bedrock/sdk-ui/lib/utils";

import type {
  TreasuryDialogFact,
  TreasuryDialogHint,
} from "../lib/dialogs";

export function TreasuryDialogLayout({
  aside,
  children,
}: {
  aside: React.ReactNode;
  children: React.ReactNode;
}) {
  return <div className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">{children}{aside}</div>;
}

export function TreasuryDialogSection({
  description,
  title,
  children,
}: {
  children: React.ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <div className="text-sm font-semibold">{title}</div>
        {description ? (
          <div className="text-muted-foreground text-sm leading-6">
            {description}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function TreasuryDialogHintCard({
  hint,
}: {
  hint: TreasuryDialogHint;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3",
        hint.tone === "warning"
          ? "border-amber-200 bg-amber-50 text-amber-950"
          : "bg-muted/30",
      )}
    >
      <div className="text-sm font-medium">{hint.title}</div>
      <div className="text-muted-foreground mt-1 text-sm leading-6">
        {hint.description}
      </div>
    </div>
  );
}

export function TreasuryDialogFactList({
  facts,
}: {
  facts: TreasuryDialogFact[];
}) {
  return (
    <dl className="space-y-3">
      {facts.map((fact) => (
        <div
          key={`${fact.label}:${fact.value}`}
          className="flex items-start justify-between gap-4"
        >
          <dt className="text-muted-foreground text-sm">{fact.label}</dt>
          <dd className="max-w-[65%] text-right text-sm font-medium">
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function TreasuryDialogSidebar({
  children,
}: {
  children: React.ReactNode;
}) {
  return <aside className="space-y-4">{children}</aside>;
}
