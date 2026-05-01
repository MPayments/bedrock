import { Button } from "@bedrock/sdk-ui/components/button";
import { Checkbox } from "@bedrock/sdk-ui/components/checkbox";
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

import {
  ATTACHMENT_PURPOSE_LABELS,
  ATTACHMENT_VISIBILITY_LABELS,
} from "./constants";
import { formatFileSize } from "./file-utils";

type UploadAttachmentDialogProps = {
  open: boolean;
  uploadFile: File | null;
  uploadDescription: string;
  uploadPurpose: "invoice" | "contract" | "other";
  useRecognition: boolean;
  uploadVisibility: "customer_safe" | "internal";
  isUploading: boolean;
  onOpenChange: (open: boolean) => void;
  onFileChange: (file: File | null) => void;
  onDescriptionChange: (value: string) => void;
  onPurposeChange: (value: "invoice" | "contract" | "other") => void;
  onUseRecognitionChange: (value: boolean) => void;
  onVisibilityChange: (value: "customer_safe" | "internal") => void;
  onCancel: () => void;
  onSubmit: () => void;
};

export function UploadAttachmentDialog({
  open,
  uploadFile,
  uploadDescription,
  uploadPurpose,
  useRecognition,
  uploadVisibility,
  isUploading,
  onOpenChange,
  onFileChange,
  onDescriptionChange,
  onPurposeChange,
  onUseRecognitionChange,
  onVisibilityChange,
  onCancel,
  onSubmit,
}: UploadAttachmentDialogProps) {
  const uploadPurposeLabel = ATTACHMENT_PURPOSE_LABELS[uploadPurpose];
  const uploadVisibilityLabel = ATTACHMENT_VISIBILITY_LABELS[uploadVisibility];
  const canUseRecognition =
    uploadPurpose === "invoice" || uploadPurpose === "contract";

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
              data-testid="deal-attachment-file-input"
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
              data-testid="deal-attachment-description-input"
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
                if (
                  value === "invoice" ||
                  value === "contract" ||
                  value === "other"
                ) {
                  onPurposeChange(value);
                  if (value === "other") {
                    onUseRecognitionChange(false);
                  }
                }
              }}
            >
              <SelectTrigger data-testid="deal-attachment-purpose-select">
                <SelectValue placeholder="Выберите тип файла">
                  {uploadPurposeLabel}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="invoice">
                  {ATTACHMENT_PURPOSE_LABELS.invoice}
                </SelectItem>
                <SelectItem value="contract">
                  {ATTACHMENT_PURPOSE_LABELS.contract}
                </SelectItem>
                <SelectItem value="other">
                  {ATTACHMENT_PURPOSE_LABELS.other}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              id="deal-attachment-use-recognition"
              checked={canUseRecognition && useRecognition}
              disabled={!canUseRecognition}
              onCheckedChange={(checked) =>
                onUseRecognitionChange(Boolean(checked))
              }
            />
            <div className="grid gap-1">
              <Label
                className="text-sm font-medium"
                htmlFor="deal-attachment-use-recognition"
              >
                Распознать данные из файла
              </Label>
              <p className="text-xs text-muted-foreground">
                Для инвойсов и договоров система попробует заполнить поля
                сделки.
              </p>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Видимость</Label>
            <Select
              value={uploadVisibility}
              onValueChange={(value) => {
                if (value === "customer_safe" || value === "internal") {
                  onVisibilityChange(value);
                }
              }}
            >
              <SelectTrigger data-testid="deal-attachment-visibility-select">
                <SelectValue placeholder="Выберите видимость">
                  {uploadVisibilityLabel}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">
                  {ATTACHMENT_VISIBILITY_LABELS.internal}
                </SelectItem>
                <SelectItem value="customer_safe">
                  {ATTACHMENT_VISIBILITY_LABELS.customer_safe}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onCancel} variant="outline">
            Отмена
          </Button>
          <Button
            data-testid="deal-attachment-submit"
            disabled={!uploadFile || isUploading}
            onClick={onSubmit}
          >
            {isUploading ? "Загрузка..." : "Загрузить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
