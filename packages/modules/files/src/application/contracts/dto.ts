import { Buffer } from "node:buffer";
import { z } from "zod";

import {
  FileAttachmentPurposeSchema,
  FileAttachmentVisibilitySchema,
  FileGeneratedFormatSchema,
  FileGeneratedLangSchema,
  FileLinkKindSchema,
  FileOriginSchema,
} from "./zod";

export const FileAssetSchema = z.object({
  id: z.uuid(),
  currentVersionId: z.uuid(),
  origin: FileOriginSchema,
  description: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type FileAsset = z.infer<typeof FileAssetSchema>;

export const FileVersionSchema = z.object({
  id: z.uuid(),
  versionNumber: z.number().int().positive(),
  fileName: z.string(),
  mimeType: z.string(),
  fileSize: z.number().int().nonnegative(),
  checksum: z.string(),
  storageKey: z.string(),
  createdBy: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type FileVersion = z.infer<typeof FileVersionSchema>;

export const FileLinkSchema = z.object({
  attachmentPurpose: FileAttachmentPurposeSchema.nullable(),
  attachmentVisibility: FileAttachmentVisibilitySchema.nullable(),
  id: z.uuid(),
  linkKind: FileLinkKindSchema,
  dealId: z.uuid().nullable(),
  counterpartyId: z.uuid().nullable(),
  generatedFormat: FileGeneratedFormatSchema.nullable(),
  generatedLang: FileGeneratedLangSchema.nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type FileLink = z.infer<typeof FileLinkSchema>;

export const FileDetailsSchema = FileAssetSchema.extend({
  currentVersion: FileVersionSchema,
  link: FileLinkSchema,
});

export type FileDetails = z.infer<typeof FileDetailsSchema>;

export const FileAttachmentSchema = z.object({
  id: z.uuid(),
  fileName: z.string(),
  fileSize: z.number().int().nonnegative(),
  mimeType: z.string(),
  purpose: FileAttachmentPurposeSchema.nullable(),
  visibility: FileAttachmentVisibilitySchema.nullable(),
  uploadedBy: z.string().nullable(),
  description: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type FileAttachment = z.infer<typeof FileAttachmentSchema>;

export const FileAttachmentContentSchema = z.object({
  buffer: z.instanceof(Buffer),
  fileName: z.string(),
  mimeType: z.string(),
  purpose: FileAttachmentPurposeSchema.nullable(),
  visibility: FileAttachmentVisibilitySchema.nullable(),
});

export type FileAttachmentContent = z.infer<typeof FileAttachmentContentSchema>;
