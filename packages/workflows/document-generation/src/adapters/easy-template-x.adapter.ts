import * as fs from "node:fs";
import * as path from "node:path";

import type { Logger } from "@bedrock/platform/observability/logger";

import type { ObjectStoragePort, TemplateRendererPort } from "../service";

export interface EasyTemplateXAdapterConfig {
  templatesDir: string;
  objectStorage?: ObjectStoragePort;
  logger: Logger;
}

export function createEasyTemplateXAdapter(
  config: EasyTemplateXAdapterConfig,
): TemplateRendererPort & {
  parseTags(templateType: string, organizationId?: string): Promise<string[]>;
  listTemplates(organizationId?: string): Promise<string[]>;
} {
  const { templatesDir, objectStorage, logger } = config;

  async function getTemplateBuffer(
    templateName: string,
    organizationId?: string,
  ): Promise<Buffer> {
    if (organizationId != null && objectStorage) {
      try {
        const s3Key = `organizations/${organizationId}/templates/${templateName}`;
        const fromS3 = await objectStorage.download(s3Key);
        if (fromS3 && fromS3.length > 0) {
          logger.debug("Using organization template from S3", {
            organizationId,
            templateName,
          });
          return fromS3;
        }
      } catch {
        // Fall through to filesystem
      }
    }

    const templatePath = path.join(templatesDir, templateName);
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template ${templateName} not found`);
    }
    return fs.promises.readFile(templatePath);
  }

  return {
    async renderDocx(
      templateType: string,
      data: Record<string, unknown>,
      _locale: string,
      organizationId?: string,
    ): Promise<Buffer> {
      const templateName = templateType.endsWith(".docx")
        ? templateType
        : `${templateType}.docx`;

      const templateBuffer = await getTemplateBuffer(
        templateName,
        organizationId,
      );

      const easyTemplateX = await import("easy-template-x");
      const handler = new easyTemplateX.TemplateHandler();
      const result = await handler.process(templateBuffer, data as Record<string, any>);
      return Buffer.from(result);
    },

    async parseTags(
      templateType: string,
      organizationId?: string,
    ): Promise<string[]> {
      const templateName = templateType.endsWith(".docx")
        ? templateType
        : `${templateType}.docx`;

      const templateBuffer = await getTemplateBuffer(
        templateName,
        organizationId,
      );

      const easyTemplateX = await import("easy-template-x");
      const handler = new easyTemplateX.TemplateHandler();
      const tags: Array<{ name: string }> =
        await handler.parseTags(templateBuffer);

      const IMAGE_FIELDS = new Set(["signature", "stamp"]);
      const names = tags
        .map((tag) => tag.name)
        .filter((name) => !IMAGE_FIELDS.has(name));

      return [...new Set(names)];
    },

    async listTemplates(organizationId?: string): Promise<string[]> {
      const localFiles = fs.existsSync(templatesDir)
        ? (await fs.promises.readdir(templatesDir)).filter((f) =>
            f.endsWith(".docx"),
          )
        : [];

      if (organizationId != null && objectStorage) {
        // In the future, list org-specific templates from S3
        // For now, return local templates only
      }

      return localFiles.sort();
    },
  };
}
