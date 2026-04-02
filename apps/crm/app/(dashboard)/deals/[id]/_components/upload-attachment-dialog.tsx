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

import { formatFileSize } from "./file-utils";

type UploadAttachmentDialogProps = {
  open: boolean;
  uploadFile: File | null;
  uploadDescription: string;
  uploadPurpose: "invoice" | "contract" | "other";
  uploadVisibility: "customer_safe" | "internal";
  isUploading: boolean;
  onOpenChange: (open: boolean) => void;
  onFileChange: (file: File | null) => void;
  onDescriptionChange: (value: string) => void;
  onPurposeChange: (value: "invoice" | "contract" | "other") => void;
  onVisibilityChange: (value: "customer_safe" | "internal") => void;
  onCancel: () => void;
  onSubmit: () => void;
};

export function UploadAttachmentDialog({
  open,
  uploadFile,
  uploadDescription,
  uploadPurpose,
  uploadVisibility,
  isUploading,
  onOpenChange,
  onFileChange,
  onDescriptionChange,
  onPurposeChange,
  onVisibilityChange,
  onCancel,
  onSubmit,
}: UploadAttachmentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              onChange={(event) => {
                onFileChange(event.target.files?.[0] ?? null);
              }}
              type="file"
            />
            {uploadFile && (
              <div className="text-sm text-muted-foreground">
                {uploadFile.name} · {formatFileSize(uploadFile.size)}
              </div>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="deal-attachment-description">Описание</Label>
            <Input
              id="deal-attachment-description"
              onChange={(event) => onDescriptionChange(event.target.value)}
              placeholder="Например: подписанный комплект"
              value={uploadDescription}
            />
          </div>
          <div className="grid gap-2">
            <Label>Тип файла</Label>
            <Select
              value={uploadPurpose}
              onValueChange={(value) => {
                if (value === "invoice" || value === "contract" || value === "other") {
                  onPurposeChange(value);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="invoice">Инвойс</SelectItem>
                <SelectItem value="contract">Договор</SelectItem>
                <SelectItem value="other">Другое</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Видимость</Label>
            <Select
              value={uploadVisibility}
              onValueChange={(value) => {
                if (value) {
                  onVisibilityChange(value);
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
          <Button onClick={onCancel} variant="outline">
            Отмена
          </Button>
          <Button disabled={!uploadFile || isUploading} onClick={onSubmit}>
            {isUploading ? "Загрузка..." : "Загрузить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
