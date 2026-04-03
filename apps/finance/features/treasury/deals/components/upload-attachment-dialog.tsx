"use client";

import { useState } from "react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bedrock/sdk-ui/components/dialog";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Label } from "@bedrock/sdk-ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import { executeMutation } from "@/lib/resources/http";

import { formatFileSize } from "./file-utils";

type UploadAttachmentDialogProps = {
  dealId: string;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  open: boolean;
};

export function UploadAttachmentDialog({
  dealId,
  onOpenChange,
  onSuccess,
  open,
}: UploadAttachmentDialogProps) {
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadVisibility, setUploadVisibility] = useState<
    "customer_safe" | "internal"
  >("internal");
  const [isUploading, setIsUploading] = useState(false);

  function resetState() {
    setUploadDescription("");
    setUploadFile(null);
    setUploadVisibility("internal");
  }

  async function handleSubmit() {
    if (!uploadFile) {
      toast.error("Выберите файл для загрузки");
      return;
    }

    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", uploadFile);

    if (uploadDescription.trim()) {
      formData.append("description", uploadDescription.trim());
    }

    formData.append("visibility", uploadVisibility);

    const result = await executeMutation({
      fallbackMessage: "Не удалось загрузить вложение",
      request: () =>
        fetch(`/v1/deals/${encodeURIComponent(dealId)}/attachments`, {
          method: "POST",
          credentials: "include",
          body: formData,
        }),
    });

    setIsUploading(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Вложение загружено");
    resetState();
    onOpenChange(false);
    onSuccess();
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetState();
    }

    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Загрузить вложение</DialogTitle>
          <DialogDescription>
            Добавьте файл к сделке. Это отдельное вложение, не формальный
            документ.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="deal-attachment-file">Файл</Label>
            <Input
              id="deal-attachment-file"
              type="file"
              onChange={(event) => {
                setUploadFile(event.target.files?.[0] ?? null);
              }}
            />
            {uploadFile ? (
              <div className="text-sm text-muted-foreground">
                {uploadFile.name} · {formatFileSize(uploadFile.size)}
              </div>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="deal-attachment-description">Описание</Label>
            <Input
              id="deal-attachment-description"
              placeholder="Например: подписанный комплект"
              value={uploadDescription}
              onChange={(event) => setUploadDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Видимость</Label>
            <Select
              value={uploadVisibility}
              onValueChange={(value) => {
                if (value === "customer_safe" || value === "internal") {
                  setUploadVisibility(value);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Только CRM / внутреннее</SelectItem>
                <SelectItem value="customer_safe">
                  Видно клиенту и CRM
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Отмена
          </Button>
          <Button disabled={!uploadFile || isUploading} onClick={handleSubmit}>
            {isUploading ? "Загрузка..." : "Загрузить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
