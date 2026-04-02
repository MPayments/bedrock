import { z } from "zod";

import {
  FILE_ATTACHMENT_PURPOSE_VALUES,
  FILE_ATTACHMENT_VISIBILITY_VALUES,
  FILE_GENERATED_FORMAT_VALUES,
  FILE_GENERATED_LANG_VALUES,
  FILE_LINK_KIND_VALUES,
  FILE_ORIGIN_VALUES,
} from "../../domain/constants";

export const FileOriginSchema = z.enum(FILE_ORIGIN_VALUES);
export const FileLinkKindSchema = z.enum(FILE_LINK_KIND_VALUES);
export const FileGeneratedFormatSchema = z.enum(FILE_GENERATED_FORMAT_VALUES);
export const FileGeneratedLangSchema = z.enum(FILE_GENERATED_LANG_VALUES);
export const FileAttachmentPurposeSchema = z.enum(
  FILE_ATTACHMENT_PURPOSE_VALUES,
);
export const FileAttachmentVisibilitySchema = z.enum(
  FILE_ATTACHMENT_VISIBILITY_VALUES,
);

export type FileOrigin = z.infer<typeof FileOriginSchema>;
export type FileLinkKind = z.infer<typeof FileLinkKindSchema>;
export type FileGeneratedFormat = z.infer<typeof FileGeneratedFormatSchema>;
export type FileGeneratedLang = z.infer<typeof FileGeneratedLangSchema>;
export type FileAttachmentPurpose = z.infer<typeof FileAttachmentPurposeSchema>;
export type FileAttachmentVisibility = z.infer<
  typeof FileAttachmentVisibilitySchema
>;
