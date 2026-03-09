"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, MoreHorizontal, Trash2 } from "lucide-react";

import { Button } from "@multihansa/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@multihansa/ui/components/dropdown-menu";
import { toast } from "@multihansa/ui/components/sonner";

import { executeMutation, type HttpResponseLike } from "@/lib/resources/http";
import { EntityDeleteDialog } from "@/components/entities/entity-delete-dialog";

type EntityRowActionsProps = {
  openHref: string;
  ariaLabel: string;
  deleteDialogTitle: string;
  deleteDialogDescription: React.ReactNode;
  deleteFallbackMessage: string;
  deleteSuccessMessage: string;
  deleteRequest: () => Promise<HttpResponseLike>;
  onDeleted?: () => void;
  stopRowDoubleClick?: boolean;
};

export function EntityRowActions({
  openHref,
  ariaLabel,
  deleteDialogTitle,
  deleteDialogDescription,
  deleteFallbackMessage,
  deleteSuccessMessage,
  deleteRequest,
  onDeleted,
  stopRowDoubleClick = false,
}: EntityRowActionsProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(): Promise<boolean> {
    setDeleting(true);

    const result = await executeMutation<void>({
      request: deleteRequest,
      fallbackMessage: deleteFallbackMessage,
      parseData: async () => undefined,
    });

    setDeleting(false);

    if (!result.ok) {
      toast.error(result.message);
      return false;
    }

    toast.success(deleteSuccessMessage);
    onDeleted?.();
    return true;
  }

  return (
    <div
      className="flex justify-end"
      onDoubleClick={
        stopRowDoubleClick ? (event) => event.stopPropagation() : undefined
      }
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="icon"
              variant="ghost"
              type="button"
              aria-label={ariaLabel}
              disabled={deleting}
            />
          }
        >
          <MoreHorizontal size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-34">
          <DropdownMenuItem render={<Link href={openHref} />}>
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

      <EntityDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        deleting={deleting}
        onDelete={handleDelete}
        title={deleteDialogTitle}
        description={deleteDialogDescription}
      />
    </div>
  );
}
