"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, MoreHorizontal, Trash2 } from "lucide-react";

import { Button } from "@bedrock/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@bedrock/ui/components/dropdown-menu";
import { toast } from "@bedrock/ui/components/sonner";

import { apiClient } from "@/lib/api-client";
import { resolveApiErrorMessage } from "@/lib/api-error";
import { CustomerDeleteDialog } from "./customer-delete-dialog";

type CustomerRowActionModel = {
  id: string;
  displayName: string;
};

type CustomerRowActionsProps = {
  customer: CustomerRowActionModel;
};

export function CustomerRowActions({ customer }: CustomerRowActionsProps) {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(): Promise<boolean> {
    setDeleting(true);

    try {
      const res = await apiClient.v1.customers[":id"].$delete({
        param: { id: customer.id },
      });

      if (!res.ok) {
        let payload: unknown = null;
        try {
          payload = await res.json();
        } catch {
          // Ignore non-JSON error payloads.
        }

        const message = resolveApiErrorMessage(
          res.status,
          payload,
          "Не удалось удалить клиента",
        );
        toast.error(message);
        return false;
      }

      toast.success("Клиент удален");
      router.refresh();
      return true;
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : "Не удалось удалить клиента";
      toast.error(message);
      return false;
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="icon"
              variant="ghost"
              type="button"
              aria-label={`Действия для клиента ${customer.displayName}`}
              disabled={deleting}
            />
          }
        >
          <MoreHorizontal size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-34">
          <DropdownMenuItem
            render={<Link href={`/entities/customers/${customer.id}`} />}
          >
            <Eye size={16} />
            Открыть
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={deleting}
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 size={16} />
            Удалить
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CustomerDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        deleting={deleting}
        onDelete={handleDelete}
      />
    </div>
  );
}
