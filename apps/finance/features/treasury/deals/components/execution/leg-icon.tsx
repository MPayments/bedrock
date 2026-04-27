"use client";

import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpFromLine,
  type LucideIcon,
} from "lucide-react";

const LEG_KIND_ICONS: Record<string, LucideIcon> = {
  collect: ArrowDownToLine,
  convert: ArrowLeftRight,
  transit_hold: ArrowRight,
  payout: ArrowUpFromLine,
  settle_exporter: ArrowUpFromLine,
};

export function getLegKindIcon(kind: string): LucideIcon {
  return LEG_KIND_ICONS[kind] ?? ArrowRight;
}
