"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Eye, MoreHorizontal, Trash2 } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@bedrock/sdk-ui/components/dropdown-menu";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import { archivePaymentRouteTemplate, duplicatePaymentRouteTemplate } from "../lib/mutations";

type PaymentRouteRowActionsProps = {
  routeId: string;
  routeName: string;
};

export function PaymentRouteRowActions({
  routeId,
  routeName,
}: PaymentRouteRowActionsProps) {
  const router = useRouter();
  const [submitting, startTransition] = React.useTransition();

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicatePaymentRouteTemplate(routeId);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Маршрут продублирован");
      router.push(`/routes/constructor/${result.data.id}`);
      router.refresh();
    });
  }

  function handleArchive() {
    if (!window.confirm(`Архивировать маршрут "${routeName}"?`)) {
      return;
    }

    startTransition(async () => {
      const result = await archivePaymentRouteTemplate(routeId);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Маршрут архивирован");
      router.refresh();
    });
  }

  return (
    <div className="flex justify-end" onDoubleClick={(event) => event.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="icon"
              variant="ghost"
              type="button"
              disabled={submitting}
              aria-label={`Действия для маршрута ${routeName}`}
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem render={<Link href={`/routes/constructor/${routeId}`} />}>
            <Eye className="size-4" />
            Открыть
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDuplicate}>
            <Copy className="size-4" />
            Дублировать
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleArchive}>
            <Trash2 className="size-4" />
            Архивировать
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

