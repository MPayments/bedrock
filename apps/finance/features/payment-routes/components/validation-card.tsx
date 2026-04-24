"use client";

import { AlertTriangle, Check, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { cn } from "@bedrock/sdk-ui/lib/utils";

import type {
  PaymentRouteValidationCheck,
  PaymentRouteValidationStatus,
} from "../lib/validation";

type Props = {
  checks: PaymentRouteValidationCheck[];
  className?: string;
};

const STATUS_STYLE: Record<
  PaymentRouteValidationStatus,
  { icon: LucideIcon; iconClassName: string; badgeClassName: string }
> = {
  error: {
    badgeClassName: "bg-destructive/10 text-destructive",
    icon: X,
    iconClassName: "text-destructive",
  },
  ok: {
    badgeClassName: "bg-emerald-100 text-emerald-700",
    icon: Check,
    iconClassName: "text-emerald-700",
  },
  warning: {
    badgeClassName: "bg-amber-100 text-amber-700",
    icon: AlertTriangle,
    iconClassName: "text-amber-700",
  },
};

export function PaymentRouteValidationCard({ checks, className }: Props) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Проверки</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {checks.map((check) => {
            const style = STATUS_STYLE[check.status];
            const Icon = style.icon;

            return (
              <li key={check.id} className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                    style.badgeClassName,
                  )}
                >
                  <Icon className={cn("size-3", style.iconClassName)} />
                </span>
                <div className="min-w-0 space-y-0.5">
                  <div className="text-sm">{check.title}</div>
                  {check.detail ? (
                    <div className="text-xs text-muted-foreground">
                      {check.detail}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
