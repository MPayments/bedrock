import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, jsonSchema } from "ai";
import * as mammoth from "mammoth";
import * as XLSX from "xlsx";
import { z, toJSONSchema } from "zod";

import type { ExtractedDocumentData } from "./contracts";
import type {
  DocumentExtractionOptions,
  DocumentExtractionPort,
} from "./extraction.port";

export interface OpenAIConfig {
  apiKey: string;
  model?: string;
}

const SYSTEM_EXTRACT = [
  "You are a strict JSON extraction engine.",
  "Extract all relevant data from the provided document.",
  "Use the schema to answer with valid JSON only — no prose.",
].join(" ");

const extractedDocumentZodSchema = z.object({
  companyName: z.string().nullable(),
  inn: z.string().nullable(),
  kpp: z.string().nullable(),
  ogrn: z.string().nullable(),
  address: z.string().nullable(),
  directorName: z.string().nullable(),
  directorPosition: z.string().nullable(),
  bankName: z.string().nullable(),
  bankAccount: z.string().nullable(),
  bic: z.string().nullable(),
  corrAccount: z.string().nullable(),
  amount: z.string().nullable(),
  currency: z.string().nullable(),
  date: z.string().nullable(),
  number: z.string().nullable(),
  additionalFields: z.record(z.string(), z.string()).optional(),
});

function createDocumentSchema() {
  return jsonSchema<ExtractedDocumentData>(
    toJSONSchema(extractedDocumentZodSchema) as Parameters<typeof jsonSchema>[0],
    {
      validate: (value) => {
        const result = extractedDocumentZodSchema.safeParse(value);
        if (result.success) {
          return { success: true, value: result.data as ExtractedDocumentData };
        }
        return { success: false, error: new Error(JSON.stringify(result.error)) };
      },
    },
  );
}

function createTranslationSchema(fieldKeys: string[]) {
  const shape: Record<string, z.ZodString> = {};
  for (const key of fieldKeys) {
    shape[key] = z.string();
  }
  const zodSchema = z.object(shape);

  return jsonSchema<Record<string, string>>(
    toJSONSchema(zodSchema) as Parameters<typeof jsonSchema>[0],
    {
      validate: (value) => {
        const result = zodSchema.safeParse(value);
        if (result.success) {
          return { success: true, value: result.data as Record<string, string> };
        }
        return { success: false, error: new Error(JSON.stringify(result.error)) };
      },
    },
  );
}

function buildExtractionInstruction(
  options?: DocumentExtractionOptions,
) {
  const instructions = options?.instructions?.trim();
  if (!instructions) {
    return SYSTEM_EXTRACT;
  }

  return `${SYSTEM_EXTRACT}\n${instructions}`;
}

export class OpenAIDocumentExtractionAdapter implements DocumentExtractionPort {
  private readonly model: string;
  private readonly openai: ReturnType<typeof createOpenAI>;

  constructor(config: OpenAIConfig) {
    if (!config.apiKey) {
      throw new Error(
        "OpenAI API key is required. Provide it via OpenAIConfig.apiKey.",
      );
    }

    this.model = config.model ?? "gpt-4o";
    this.openai = createOpenAI({ apiKey: config.apiKey });
  }

  async extractFromPdf(buffer: Buffer): Promise<ExtractedDocumentData> {
    const base64 = buffer.toString("base64");
    const dataUrl = `data:application/pdf;base64,${base64}`;

    const result = await generateObject({
      model: this.openai(this.model),
      messages: [
        { role: "system", content: SYSTEM_EXTRACT },
        {
          role: "user",
          content: [
            {
              type: "file",
              data: dataUrl,
              mimeType: "application/pdf",
            },
          ],
        },
      ],
      schema: createDocumentSchema(),
    });

    return result.object;
  }

  async extractFromDocx(buffer: Buffer): Promise<ExtractedDocumentData> {
    const { value: text } = await mammoth.extractRawText({ buffer });

    if (!text.trim()) {
      throw new Error("Failed to extract text from DOCX document.");
    }

    return this.extractFromText(text);
  }

  async extractFromXlsx(buffer: Buffer): Promise<ExtractedDocumentData> {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheets: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const csv = XLSX.utils.sheet_to_csv(sheet);
      sheets.push(`--- Sheet: ${sheetName} ---\n${csv}`);
    }

    const text = sheets.join("\n\n");

    if (!text.trim()) {
      throw new Error("Failed to extract data from XLSX document.");
    }

    return this.extractFromText(text);
  }

  async extractFromBuffer<T extends z.ZodTypeAny>(
    buffer: Buffer,
    mimeType: string,
    schema: T,
    options?: DocumentExtractionOptions,
  ): Promise<z.infer<T>> {
    if (mimeType === "application/pdf") {
      const base64 = buffer.toString("base64");
      const dataUrl = `data:application/pdf;base64,${base64}`;

      const result = await generateObject({
        model: this.openai(this.model),
        messages: [
          {
            role: "system",
            content: buildExtractionInstruction(options),
          },
          {
            role: "user",
            content: [
              { type: "file", data: dataUrl, mimeType: "application/pdf" },
            ],
          },
        ],
        schema: jsonSchema<z.infer<T>>(
          toJSONSchema(schema) as Parameters<typeof jsonSchema>[0],
          {
            validate: (value) => {
              const parsed = schema.safeParse(value);
              if (parsed.success) return { success: true, value: parsed.data };
              return { success: false, error: new Error(JSON.stringify(parsed.error)) };
            },
          },
        ),
      });
      return result.object;
    }

    // Word documents
    if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimeType === "application/msword"
    ) {
      const { value: text } = await mammoth.extractRawText({ buffer });
      if (!text.trim()) throw new Error("Failed to extract text from DOCX.");
      return this.extractTextWithSchema(text, schema, options);
    }

    // Excel documents
    if (
      mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mimeType === "application/vnd.ms-excel"
    ) {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheets: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        sheets.push(`--- Sheet: ${sheetName} ---\n${XLSX.utils.sheet_to_csv(sheet)}`);
      }
      const text = sheets.join("\n\n");
      if (!text.trim()) throw new Error("Failed to extract data from XLSX.");
      return this.extractTextWithSchema(text, schema, options);
    }

    throw new Error(`Unsupported mime type: ${mimeType}`);
  }

  async translateFields(
    data: Record<string, string>,
    fromLang: string,
    toLang: string,
  ): Promise<Record<string, string>> {
    const fieldKeys = Object.keys(data);

    if (fieldKeys.length === 0) {
      return {};
    }

    const fieldsText = fieldKeys.map((key) => `${key}: ${data[key]}`).join("\n");

    const result = await generateObject({
      model: this.openai(this.model),
      messages: [
        {
          role: "system",
          content: [
            `You are a professional legal translator from ${fromLang} to ${toLang}.`,
            `Translate the provided fields accurately.`,
            `Rules:`,
            `- Company names, personal names, and addresses must be transliterated (not literally translated). Use standard Latin transliteration for names.`,
            `- Legal terms must be translated to their proper ${toLang} legal equivalents.`,
            `- Preserve the structure and meaning of addresses, only transliterating street/city names.`,
            `- Keep numbers, dates, and codes as-is.`,
            `- Return the translations using the exact same keys as provided.`,
          ].join("\n"),
        },
        {
          role: "user",
          content: `Translate these fields:\n${fieldsText}`,
        },
      ],
      schema: createTranslationSchema(fieldKeys),
    });

    return result.object;
  }

  private async extractFromText(
    text: string,
  ): Promise<ExtractedDocumentData> {
    const result = await generateObject({
      model: this.openai(this.model),
      messages: [
        { role: "system", content: SYSTEM_EXTRACT },
        { role: "user", content: text },
      ],
      schema: createDocumentSchema(),
    });

    return result.object;
  }

  private async extractTextWithSchema<T extends z.ZodTypeAny>(
    text: string,
    schema: T,
    options?: DocumentExtractionOptions,
  ): Promise<z.infer<T>> {
    const result = await generateObject({
      model: this.openai(this.model),
      messages: [
        {
          role: "system",
          content: buildExtractionInstruction(options),
        },
        { role: "user", content: text },
      ],
      schema: jsonSchema<z.infer<T>>(
        toJSONSchema(schema) as Parameters<typeof jsonSchema>[0],
        {
          validate: (value) => {
            const parsed = schema.safeParse(value);
            if (parsed.success) return { success: true, value: parsed.data };
            return { success: false, error: new Error(JSON.stringify(parsed.error)) };
          },
        },
      ),
    });
    return result.object;
  }
}
