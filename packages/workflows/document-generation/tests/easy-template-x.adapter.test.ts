import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createEasyTemplateXAdapter } from "../src/adapters/easy-template-x.adapter";

vi.mock("easy-template-x", () => ({
  TemplateHandler: class {
    async process(buf: Buffer): Promise<Buffer> {
      return buf;
    }
    async parseTags(_buf: Buffer): Promise<{ name: string }[]> {
      return [];
    }
  },
}));

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(),
} as any;

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "doc-gen-tpl-"));
}

const cleanups: string[] = [];

afterEach(() => {
  while (cleanups.length > 0) {
    const dir = cleanups.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("easy-template-x adapter — locale-aware template resolution", () => {
  it("renderDocx with locale=ru picks ru_<type>.docx when present", async () => {
    const tmp = makeTmpDir();
    cleanups.push(tmp);
    fs.writeFileSync(path.join(tmp, "invoice.docx"), Buffer.from("base"));
    fs.writeFileSync(path.join(tmp, "ru_invoice.docx"), Buffer.from("ru"));

    const adapter = createEasyTemplateXAdapter({ templatesDir: tmp, logger });

    const buf = await adapter.renderDocx("invoice", {}, "ru");

    expect(buf.toString()).toBe("ru");
  });

  it("renderDocx with locale=ru falls back to base when ru_<type>.docx is missing", async () => {
    const tmp = makeTmpDir();
    cleanups.push(tmp);
    fs.writeFileSync(path.join(tmp, "invoice.docx"), Buffer.from("base"));

    const adapter = createEasyTemplateXAdapter({ templatesDir: tmp, logger });

    const buf = await adapter.renderDocx("invoice", {}, "ru");

    expect(buf.toString()).toBe("base");
  });

  it("renderDocx with locale=en uses only the base template, ignoring any en_<type>.docx", async () => {
    const tmp = makeTmpDir();
    cleanups.push(tmp);
    fs.writeFileSync(path.join(tmp, "invoice.docx"), Buffer.from("base"));
    // en_invoice.docx must not be picked: locale=en intentionally maps to the base
    fs.writeFileSync(path.join(tmp, "en_invoice.docx"), Buffer.from("en-prefixed"));

    const adapter = createEasyTemplateXAdapter({ templatesDir: tmp, logger });

    const buf = await adapter.renderDocx("invoice", {}, "en");

    expect(buf.toString()).toBe("base");
  });

  it("renderDocx throws when neither locale-prefixed nor base template exists", async () => {
    const tmp = makeTmpDir();
    cleanups.push(tmp);

    const adapter = createEasyTemplateXAdapter({ templatesDir: tmp, logger });

    await expect(adapter.renderDocx("invoice", {}, "ru")).rejects.toThrow(
      /ru_invoice\.docx or invoice\.docx not found/,
    );
  });

  it("renderDocx accepts an explicit .docx extension and skips locale prefixing", async () => {
    const tmp = makeTmpDir();
    cleanups.push(tmp);
    fs.writeFileSync(path.join(tmp, "ru_invoice.docx"), Buffer.from("ru"));
    fs.writeFileSync(path.join(tmp, "invoice.docx"), Buffer.from("base"));

    const adapter = createEasyTemplateXAdapter({ templatesDir: tmp, logger });

    const buf = await adapter.renderDocx("invoice.docx", {}, "ru");

    expect(buf.toString()).toBe("base");
  });

  it("S3 lookup is queried for the locale-prefixed name first, then the base", async () => {
    const tmp = makeTmpDir();
    cleanups.push(tmp);
    fs.writeFileSync(path.join(tmp, "invoice.docx"), Buffer.from("fs-base"));

    const objectStorage = {
      upload: vi.fn(),
      download: vi.fn(async () => {
        throw new Error("not in S3");
      }),
      delete: vi.fn(),
    };

    const adapter = createEasyTemplateXAdapter({
      templatesDir: tmp,
      logger,
      objectStorage,
    });

    await adapter.renderDocx("invoice", {}, "ru", "org-1");

    const queriedKeys = (
      objectStorage.download.mock.calls as unknown as [string][]
    ).map((call) => call[0]);
    expect(queriedKeys).toEqual([
      "organizations/org-1/templates/ru_invoice.docx",
      "organizations/org-1/templates/invoice.docx",
    ]);
  });

  it("parseTags forwards locale so RU-only placeholders are discoverable", async () => {
    const tmp = makeTmpDir();
    cleanups.push(tmp);
    fs.writeFileSync(path.join(tmp, "invoice.docx"), Buffer.from("base"));
    fs.writeFileSync(path.join(tmp, "ru_invoice.docx"), Buffer.from("ru"));

    const objectStorage = {
      upload: vi.fn(),
      download: vi.fn(async () => {
        throw new Error("not in S3");
      }),
      delete: vi.fn(),
    };

    const adapter = createEasyTemplateXAdapter({
      templatesDir: tmp,
      logger,
      objectStorage,
    });

    await adapter.parseTags("invoice", "org-1", "ru");

    const queriedKeys = (
      objectStorage.download.mock.calls as unknown as [string][]
    ).map((call) => call[0]);
    expect(queriedKeys[0]).toBe("organizations/org-1/templates/ru_invoice.docx");
  });

  it("parseTags without a locale loads the base template", async () => {
    const tmp = makeTmpDir();
    cleanups.push(tmp);
    fs.writeFileSync(path.join(tmp, "invoice.docx"), Buffer.from("base"));

    const objectStorage = {
      upload: vi.fn(),
      download: vi.fn(async () => {
        throw new Error("not in S3");
      }),
      delete: vi.fn(),
    };

    const adapter = createEasyTemplateXAdapter({
      templatesDir: tmp,
      logger,
      objectStorage,
    });

    await adapter.parseTags("invoice", "org-1");

    const queriedKeys = (
      objectStorage.download.mock.calls as unknown as [string][]
    ).map((call) => call[0]);
    expect(queriedKeys).toEqual(["organizations/org-1/templates/invoice.docx"]);
  });
});
