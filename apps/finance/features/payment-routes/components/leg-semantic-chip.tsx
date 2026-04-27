"use client";

import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpFromLine,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { cn } from "@bedrock/sdk-ui/lib/utils";
import type { PaymentRouteLegSemanticTag } from "@bedrock/treasury/contracts";

type SemanticVisual = {
  className: string;
  icon: LucideIcon;
  label: string;
};

const SEMANTIC_VISUAL: Record<PaymentRouteLegSemanticTag, SemanticVisual> = {
  collection: {
    className: "border-sky-200 bg-sky-50 text-sky-900",
    icon: ArrowDownToLine,
    label: "Сбор",
  },
  counterparty_transfer: {
    className: "border-slate-200 bg-slate-50 text-slate-900",
    icon: ArrowRight,
    label: "Через контрагента",
  },
  fx_conversion: {
    className: "border-amber-200 bg-amber-50 text-amber-900",
    icon: ArrowLeftRight,
    label: "Обмен",
  },
  intercompany_transfer: {
    className: "border-slate-200 bg-slate-50 text-slate-900",
    icon: ArrowRight,
    label: "Межкомп. перевод",
  },
  intracompany_transfer: {
    className: "border-slate-200 bg-slate-50 text-slate-900",
    icon: ArrowRight,
    label: "Внутр. перевод",
  },
  payout: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-900",
    icon: ArrowUpFromLine,
    label: "Выплата",
  },
  transfer: {
    className: "border-slate-200 bg-slate-50 text-slate-900",
    icon: ArrowRight,
    label: "Перевод",
  },
};

type Props = {
  tag: PaymentRouteLegSemanticTag;
};

export function PaymentRouteLegSemanticChip({ tag }: Props) {
  const visual = SEMANTIC_VISUAL[tag];
  const Icon = visual.icon;

  return (
    <Badge variant="outline" className={cn("gap-1", visual.className)}>
      <Icon className="size-3" />
      {visual.label}
    </Badge>
  );
}
