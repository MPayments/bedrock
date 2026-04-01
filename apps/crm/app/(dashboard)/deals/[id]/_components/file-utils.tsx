import {
  FileImage,
  FileText,
  FileType,
  Paperclip,
} from "lucide-react";

export function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return <FileImage className="h-5 w-5" />;
  }
  if (mimeType === "application/pdf") {
    return <FileText className="h-5 w-5" />;
  }
  if (mimeType.includes("word") || mimeType.includes("document")) {
    return <FileType className="h-5 w-5" />;
  }
  return <Paperclip className="h-5 w-5" />;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return "0 Б";
  }

  const units = ["Б", "КБ", "МБ", "ГБ", "ТБ"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const formatted = unitIndex === 0 ? Math.round(value) : value.toFixed(1);
  return `${formatted} ${units[unitIndex]}`;
}
