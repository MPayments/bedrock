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
  parseTags(
    templateType: string,
    organizationId?: string,
    locale?: string,
  ): Promise<string[]>;
  listTemplates(organizationId?: string): Promise<string[]>;
} {
  const { templatesDir, objectStorage, logger } = config;

  async function getTemplateBuffer(
    templateName: string,
    organizationId?: string,
  ): Promise<Buffer | null> {
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
      return null;
    }
    return fs.promises.readFile(templatePath);
  }

  function resolveTemplateNames(templateType: string, locale?: string): string[] {
    if (templateType.endsWith(".docx")) {
      return [templateType];
    }
    const base = `${templateType}.docx`;
    if (locale && locale !== "en") {
      return [`${locale}_${base}`, base];
    }
    return [base];
  }

  async function loadTemplateForLocale(
    templateType: string,
    locale: string | undefined,
    organizationId: string | undefined,
  ): Promise<Buffer> {
    const candidates = resolveTemplateNames(templateType, locale);
    for (const candidate of candidates) {
      const buffer = await getTemplateBuffer(candidate, organizationId);
      if (buffer) {
        return buffer;
      }
    }
    throw new Error(
      `Template ${candidates.join(" or ")} not found`,
    );
  }

  return {
    async renderDocx(
      templateType: string,
      data: Record<string, unknown>,
      locale: string,
      organizationId?: string,
    ): Promise<Buffer> {
      const templateBuffer = await loadTemplateForLocale(
        templateType,
        locale,
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
      locale?: string,
    ): Promise<string[]> {
      const templateBuffer = await loadTemplateForLocale(
        templateType,
        locale,
        organizationId,
      );

      const easyTemplateX = await import("easy-template-x");
      const handler = new easyTemplateX.TemplateHandler();
      const tags: { name: string }[] =
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
